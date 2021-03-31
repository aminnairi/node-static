import "regenerator-runtime";

import {createNaturalOptionParser} from "@aminnairi/natural";
import {resolve, join, extname} from "path";
import {createServer} from "http";
import {parse as parseUrl} from "url";
import {createReadStream} from "fs";
import {stat} from "fs/promises";
import mimeDatabase from "mime-db";

const additionalMimeTypes = {
  ".webmanifest": "application/json+manifest",
  ".jsm": "application/javascript",
  ".esm": "application/javascript",

};

const mimeTypes = Object.entries(mimeDatabase).reduce((previousMimeTypes, [mimeType, configuration]) => {
  if (!Array.isArray(configuration.extensions) || configuration.extensions.length === 0) {
    return previousMimeTypes;
  }

  return {
    ...previousMimeTypes,
    ...configuration.extensions.reduce((previousComputedMimeTypes, extension) => {
      return {
        ...previousComputedMimeTypes,
        [`.${extension}`]: mimeType
      };
    }, {})
  };
}, additionalMimeTypes);

const parse = createNaturalOptionParser([
  {
    name: "help",
    option: "help",
    isBoolean: true,
    isMultiple: false
  },
  {
    name: "version",
    option: "version",
    isBoolean: true,
    isMultiple: false
  },
  {
    name: "folder",
    option: "from",
    isBoolean: false,
    isMultiple: false
  },
  {
    name: "port",
    option: "port",
    isBoolean: false,
    isMultiple: false
  },
  {
    name: "host",
    option: "host",
    isBoolean: false,
    isMultiple: false
  },
  {
    name: "singlePageApplication",
    option: "spa",
    isBoolean: true,
    isMultiple: false
  }
]);

const [parsed, unknown, lone] = parse(process.argv.slice(2));

if (lone.length > 0) {
  console.error(`Lone argument: ${lone[0]}`);
  process.exit(1);
}

if (unknown.length > 0) {
  console.error(`Unknown argument: ${unknown[0]}`);
  process.exit(2);
}

if (parsed.help === true) {
  console.log("USAGE");
  console.log("  npx @aminnairi/serve [OPTIONS]");
  console.log("");
  console.log("EXAMPLES");
  console.log("  npx @aminnairi/serve folder public");
  console.log("  npx @aminnairi/serve folder public port 8080");
  console.log("  npx @aminnairi/serve folder public port 8080 host 0.0.0.0");
  console.log("  npx @aminnairi/serve folder public port 8080 host 0.0.0.0 spa");
  console.log("");
  console.log("OPTIONS");
  console.log("  help");
  console.log("    display this message");
  console.log("");
  console.log("  version");
  console.log("    display this program's version");
  console.log("");
  console.log("  folder FOLDER");
  console.log("    serve files from the FOLDER folder (default to the current directory)");
  console.log("");
  console.log("  port PORT");
  console.log("    listen to request from the PORT port (default to 8080)");
  console.log("");
  console.log("  host HOST");
  console.log("    listen to request from the HOST host (default to 127.0.0.1)");
  console.log("");
  console.log("  spa");
  console.log("    fallback to the folder's index.html file (default to false)");
  process.exit(0);
}

if (parsed.version === true) {
  console.log("0.1.0");
  process.exit(0);
}

const folder                = resolve(parsed.folder ?? process.cwd())
const port                  = Number(parsed.port) || 8080;
const host                  = parsed.host ?? "127.0.0.1";
const singlePageApplication = parsed.singlePageApplication ?? false;

if (!Number.isInteger(port)) {
  console.error(`PORT should be a number in npx @aminnairi/serve port PORT, ${JSON.stringify(parsed.port)} received.`);
  process.exit(3)
}

const server = createServer(async (request, response) => {
  const requestPath   = parseUrl(request.url).pathname ?? "";
  const filePath      = join(folder, requestPath);
  const fileExtension = extname(filePath);
  const isFile        = await stat(filePath).then(statistics => statistics.isFile()).catch(() => false);
  const fileType      = mimeTypes[fileExtension] ?? "text/plain";

  if (isFile) {
    console.log(`Responding to ${request.url} with ${filePath} as ${fileType}`);

    response.writeHead(200, {"Content-Type": fileType});

    createReadStream(filePath).pipe(response);

    return;
  }

  const indexPath   = join(filePath, "index.html");
  const isIndexFile = await stat(indexPath).then(statistics => statistics.isFile()).catch(() => false);

  if (isIndexFile) {
    console.log(`Responding to ${request.url} with ${indexPath} as a fallback`);

    response.writeHead(200, {"Content-Type": "text/html"});

    createReadStream(indexPath).pipe(response);

    return;
  }

  if (singlePageApplication) {
    const rootIndexPath = join(folder, "index.html");
    const isRootIndexFile = await stat(rootIndexPath).then(statistics => statistics.isFile()).catch(() => false);

    if (isRootIndexFile) {
      console.log(`Responding to ${request.url} with ${rootIndexPath} as a fallback because spa is enabled`);

      response.writeHead(200, {"Content-Type": "text/html"});

      createReadStream(rootIndexPath).pipe(response);

      return;
    }

    console.log(`Responding with a 404 because spa is enabled but the index.html file is not found`);

    response.writeHead(404, {"Content-Type": "text/plain"}).end(`File ${rootIndexPath} not found`);
  }

  console.log(`Responding with a 404 to ${request.url} because ${filePath} is not found`);

  response.writeHead(404, {"Content-Type": "text/plain"}).end(`File ${filePath} not found`);
});

const onInterupt = () => {
  process.removeListener("SIGINT", onInterupt);

  console.log("Gracefully stopping the server (CTRL-C again to force stop)");

  server.close();

  console.log("Successfully stopped the server.");

  process.on("SIGINT", () => {
    console.log("Stopping the server forcefully");
    process.exit(1);
  });
};

server.listen(port, host, () => {
  console.log(`Serving from ${folder} on http://${host}:${port} (CTRL-C to stop gracefully)`);
});

process.on("SIGINT", onInterupt);
