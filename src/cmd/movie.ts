import { Command } from "cliffy/command/mod.ts";
import { Confirm, GenericListOption, Select } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { walk, WalkEntry } from "std/fs/mod.ts";
import { dirname, extname, join, resolve } from "std/path/mod.ts";
import { getMovieByID, getMoviesByQuery, TmdbMovie } from "../lib/tmdb/mod.ts";
import {
  asyncIteratorToArray,
  clean,
  cleanFilename,
  removeTrailingSlash,
} from "../lib/utils.ts";
import { movieFileName } from "../lib/regex.ts";
import { subtitleExts, videoExts } from "../lib/extensions.ts";

type Options = {
  keep?: true;
  id?: string;
  query?: string[];
};

type Movie = {
  movie: string; // movie title from regex
  year: string; // year from filename regex
  path: string; // realtive filepath
  name: string; // filename
};

export default new Command()
  .arguments("<directory:string>")
  .description("Rename a movie.")
  .option(
    "-k, --keep",
    "Keep files in directory that are not renamed",
  )
  .option("-i, --id <id>", "Manually provide TMDb ID (overrides --query).")
  .option(
    "-q, --query <name...>",
    "Manually enter movie name (must be last argument).",
  )
  .action(async (options: Options, directory: string): Promise<void> => {
    console.log("movie command called", { options, directory });

    // Absolute path of directory
    const dir = resolve(Deno.cwd(), removeTrailingSlash(directory));

    // Walk dir and filter out any directories & symlinks
    const walkResults = await asyncIteratorToArray(walk(dir));
    const files = walkResults.filter((e) => e.isFile && !e.isSymlink);

    // Find movie video file
    const videoFiles: Movie[] = files.filter(isVideo).map(toMovie);
    let videoFile = videoFiles[0];
    if (videoFiles.length > 1) {
      videoFile = await pick({
        message: "Multiple video files found",
        options: videoFiles,
        mapFn: ({ name }) => name,
        compareFn: (selected, { name }) => selected === name,
      });
    }

    // Fetch movie metadata
    const query = options.query
      ? options.query.join(" ")
      : `${videoFile.movie} y:${videoFile.year}`;

    const metadatas = options.id
      ? [await getMovieByID(options.id)]
      : await getMoviesByQuery(query);

    // Select correct metadata
    let metadata = metadatas[0];
    if (metadatas.length > 1) {
      metadata = await pick({
        message: "Multiple results found",
        options: metadatas,
        mapFn: (metadata) => ({
          name: formatResultForSelect(metadata),
          value: String(metadata.id),
        }),
        compareFn: (selected, { id }) => selected === String(id),
      });
    }

    const renameBasis = cleanFilename(
      `${metadata.title} (${metadata.year}) {tmdb-${metadata.id}}`,
    );

    const videoRename = {
      path: videoFile.path,
      name: videoFile.name,
      rename: `${renameBasis}${extname(videoFile.name)}`,
      repath: join(dir, `${renameBasis}${extname(videoFile.name)}`),
    };

    const subtitleRenames = files
      .filter(({ name }) =>
        subtitleExts.has(extname(name)) &&
        /(?:(?:^|[^a-z0-9])eng?(?:lish)?[^a-z0-9])/i.test(name)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ name, path }, i) => {
        const rename = `${renameBasis}${i > 0 ? ` ${i}` : ""}.en${
          extname(name)
        }`;
        return { path, name, rename, repath: join(dir, rename) };
      });

    const renames = [videoRename, ...subtitleRenames];

    const table: Table = new Table()
      .header(["Original", "Rename"])
      .body(renames.map((rename) => [rename.name, rename.rename]))
      .padding(2)
      .border(true);

    console.log(
      `${videoFile.movie} (${videoFile.year}) - https://www.themoviedb.org/movie/${metadata.id}`,
    );
    console.log(table.toString());

    const confirmed: boolean = await Confirm.prompt(
      "Rename files as shown above?",
    );
    if (!confirmed) Deno.exit(0);

    for (const rename of renames) {
      await Deno.rename(rename.path, rename.repath);
    }

    // Purge
    if (!options.keep) {
      const doNotPurge = new Set([dir, ...renames.map(({ path }) => path)]);
      const purgeItems = walkResults.filter(({ path }) =>
        !doNotPurge.has(path)
      );
      for (const entry of purgeItems) {
        try {
          await Deno.remove(entry.path, { recursive: true });
        } catch (error) {
          if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
          }
        }
      }
    }

    // Rename directory
    const parentDir = dirname(dir);
    const redir = join(parentDir, renameBasis);
    await Deno.rename(dir, redir);
  });

function isVideo({ name }: WalkEntry): boolean {
  return videoExts.has(extname(name)) && movieFileName.test(name);
}

function toMovie({ name, path }: WalkEntry): Movie {
  const match = name.match(movieFileName);
  if (!match) throw new Error("Failed to extract movie name & year");
  const [_, rawMovie, year] = match;
  return { movie: clean(rawMovie), year, path, name };
}

async function pick<T>(
  { message, options, mapFn, compareFn }: {
    message: string;
    options: T[];
    mapFn: (option: T) => string | GenericListOption;
    compareFn: (selected: string, option: T, i: number) => boolean;
  },
): Promise<T> {
  const selected = await Select.prompt({
    message,
    options: options.map(mapFn),
  });
  const selectedOption = options.find((option, i) =>
    compareFn(selected, option, i)
  );
  if (!selectedOption) {
    throw new Error(`Failed to select option, "${selected}"`);
  }
  return selectedOption;
}

function formatResultForSelect(result: TmdbMovie): string {
  const { title, year, overview } = result;
  const prefix = `    └─ `;
  const elipsis = `...`;

  let name = `${title}`;

  if (year !== "") {
    name = `${name} (${year})`;
  }

  if (overview === "") {
    return name;
  }

  const configMax = 150;
  const { columns } = Deno.consoleSize();
  const maxLength = Math.min(configMax, columns);

  // Overview fits as-is with prefix, return early
  if (maxLength - prefix.length >= overview.length + prefix.length) {
    return [name, `${prefix}${overview}`].join("\n");
  }

  const trimLength = maxLength - prefix.length - elipsis.length;
  let trimmed = overview.substring(0, trimLength);

  // check if subtring'd in middle of word, go back a word if true
  const next = overview.substring(trimLength, trimLength + 1);
  if (/[\w\d]/.test(next)) {
    trimmed = trimmed.split(/\s/).slice(0, -1).join(" ");
  }

  // Trim until last char is a word or digit
  while (!/[\w\d]/.test(trimmed.slice(-1))) {
    trimmed = trimmed.slice(0, -1);
  }

  // const description = `    └─ ${limitWords(overview, 100)}`;
  return [name, `${prefix}${trimmed}${elipsis}`].join("\n");
}
