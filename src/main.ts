import { Command } from "cliffy/command/mod.ts";
import movie from "./cmd/movie.ts";
import tv from "./cmd/tv.ts";
import config from "./cmd/config.ts";

await new Command()
  .name("rname")
  .version("0.2.0")
  .description("Rename TV and Movies for Plex, with the help of TMDb")
  .globalOption("-d, --debug", "Display debug messages.")
  .action(function () {
    this.showHelp();
  })
  .command("movie", movie)
  .alias("m")
  .command("tv", tv)
  .alias("t")
  .command("config", config)
  .parse(Deno.args);
