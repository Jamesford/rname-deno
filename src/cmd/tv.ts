import { Command } from "cliffy/command/mod.ts";
import { Confirm, GenericListOption, Select } from "cliffy/prompt/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { walk, WalkEntry } from "std/fs/mod.ts";
import { extname, join, resolve } from "std/path/mod.ts";
import {
  getShowById,
  getShowEpisodeTitles,
  getShowsByQuery,
  TmdbShow,
} from "../lib/tmdb/mod.ts";
import {
  asyncIteratorToArray,
  clean,
  cleanFilename,
  cleanPath,
  removeTrailingSlash,
} from "../lib/utils.ts";
import { tvFileName, tvFileNameFromPath } from "../lib/regex.ts";
import { subtitleExts, videoExts } from "../lib/extensions.ts";

type Options = {
  skip?: true;
  keep?: true;
  id?: string;
  query?: string[];
};

type Show = {
  show: string; // show title from regex
  season: number; // season from regex
  episode: number; // episode from regex
  endEpisode?: number; // end episode from regex
  path: string; // realtive filepath
  name: string; // filename
};

export default new Command()
  .arguments("<directory:string>")
  .description("Rename a tv show.")
  .option("-s, --skip", "skip inclusion of episode names in filenames.")
  .option(
    "-k, --keep",
    "Keep files in directory that are not renamed",
  )
  .option("-i, --id <id>", "Manually provide TMDb ID (overrides --query).")
  .option(
    "-q, --query <name...>",
    "Manually enter movie name (must be last argument).",
  )
  .action(async (options: Options, directory: string) => {
    console.log("tv command called", { options, directory });

    // Absolute path of directory
    const dir = resolve(Deno.cwd(), removeTrailingSlash(directory));
    // console.log(dir);

    // Walk dir and filter out any directories & symlinks
    const walkResults = await asyncIteratorToArray(walk(dir));
    const files = walkResults.filter((e) => e.isFile && !e.isSymlink);
    // console.log(files);

    const showFiles = files.filter(isShow).map(toShow).sort(byEpisodeAsc);
    throwBadSeasonCount(showFiles);

    // Fetch movie metadata
    const query = options.query
      ? options.query.join(" ")
      : `${showFiles[0].show}`;

    const metadatas = options.id
      ? [await getShowById(options.id)]
      : await getShowsByQuery(query);

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

    const episodeNames = options.skip ? {} : await getShowEpisodeTitles(
      metadata.id,
      showFiles[0].season,
    );

    const renameBasis = cleanFilename(
      `${metadata.name} (${metadata.year}) {tmdb-${metadata.id}}`,
    );

    const videoRenames = showFiles.map((file) => {
      const season = String(file.season).padStart(2, "0");
      const episode = String(file.episode).padStart(2, "0");
      let rename = `${renameBasis} - s${season}e${episode}`;

      // Dual-episode files (Stargate SG-1 - S01E01-E02)
      if (file.endEpisode) {
        const endEpisode = String(file.endEpisode).padStart(2, "0");
        rename = `${rename}-e${endEpisode}`;
      }

      // Episode Title
      const name = episodeNames[file.episode];
      if (name) rename = `${rename} - ${name}`;

      // Add Extension & Clean
      rename = cleanFilename(`${rename}${extname(file.name)}`);

      return {
        path: file.path,
        name: file.name,
        rename: rename,
        repath: join(dir, rename),
      };
    });

    const subtitlesCount = new Map();
    const subtitleRenames = files
      .filter(({ name }) =>
        subtitleExts.has(extname(name)) &&
        /(?:(?:^|[^a-z0-9])eng?(?:lish)?[^a-z0-9])/i.test(name)
      )
      .map(
        ({ name, path }: WalkEntry) => {
          const match = path.match(tvFileNameFromPath);
          if (!match) throw new Error("Failed to extract tv subtitle info");
          const [_, _name, rawSeason, start, end] = match;
          const season = rawSeason.padStart(2, "0");
          const episode = start.padStart(2, "0");
          const endEpisode = end ? end.padStart(2, "0") : undefined;

          // Track number of subtitles per episode+extname to prevent duplicate filenames
          const countKey = `${episode}${extname(name)}`;
          let count = 1;
          if (subtitlesCount.has(countKey)) {
            count = subtitlesCount.get(countKey) + 1;
          }
          subtitlesCount.set(countKey, count);

          let rename = `${renameBasis} - s${season}e${episode}`;

          // Dual-episode files (Stargate SG-1 - S01E01-E02)
          if (endEpisode) rename = `${rename}-e${endEpisode}`;

          // Episode Title
          const title = episodeNames[parseInt(episode, 10)];
          if (title) rename = `${rename} - ${title}`;

          // Count
          rename = `${rename} [${count}]`;

          // Add Extension & Clean
          rename = cleanFilename(`${rename}.en${extname(name)}`);

          return {
            path: path,
            name: name,
            rename: rename,
            repath: join(dir, rename),
            episode: parseInt(episode, 10),
          };
        },
      ).sort((a, b) => a.episode - b.episode);

    const renames = [...videoRenames, ...subtitleRenames];

    const table: Table = new Table()
      .header(["Original", "Rename"])
      .body(renames.map(({ name, rename }) => [name, rename]))
      .padding(2)
      .border(true);

    console.log(
      `${metadata.name} (${metadata.year}) - https://www.themoviedb.org/movie/${metadata.id}`,
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
    const parentDir = resolve(dir, "..");
    const showDir = resolve(parentDir, cleanPath(renameBasis));
    if (!(await dirExists(showDir))) await Deno.mkdir(showDir);
    const season = String(showFiles[0].season).padStart(2, "0");
    const renameDir = resolve(showDir, `Season ${season}`);
    await Deno.rename(dir, renameDir);
  });

async function dirExists(path: string): Promise<boolean> {
  try {
    const { isDirectory } = await Deno.stat(path);
    return isDirectory;
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
    return false;
  }
}

function isShow({ name }: WalkEntry): boolean {
  return videoExts.has(extname(name)) && tvFileName.test(name);
}

function toShow({ name, path }: WalkEntry): Show {
  const match = name.match(tvFileName);
  if (!match) throw new Error("Failed to extract tv show info");
  const [_, rawName, rawSeason, startEpisode, endEpisode] = match;
  const show = clean(rawName);
  const season = parseInt(rawSeason, 10);
  return {
    show,
    season,
    episode: parseInt(startEpisode, 10),
    endEpisode: endEpisode ? parseInt(endEpisode, 10) : undefined,
    path,
    name,
  };
}

function byEpisodeAsc(a: Show, b: Show): number {
  return a.episode - b.episode;
}

const ErrMsgNoSeasons = "No seasons found, cannot proceed with renaming";
const ErrMsgMultipleSeasons =
  "Multiple seasons found, cannot change multiple seasons at once";
function throwBadSeasonCount(files: Show[]): void {
  const seasons: Set<number> = new Set();
  files.forEach(({ season }) => seasons.add(season));
  if (seasons.size < 1) throw new Error(ErrMsgNoSeasons);
  if (seasons.size > 1) throw new Error(ErrMsgMultipleSeasons);
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

function formatResultForSelect(result: TmdbShow): string {
  const { name: title, year, overview } = result;
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
