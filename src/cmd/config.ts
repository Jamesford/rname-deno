import { Command } from "cliffy/command/mod.ts";
import { Table } from "cliffy/table/mod.ts";
import { getConfig, setupConfig } from "../lib/config.ts";

type Options = { show?: true | undefined };

export default new Command()
  .description("Setup rname config options.")
  .option("-s, --show", "Show current configuration settings.")
  .action(async ({ show }: Options): Promise<void> => {
    if (show) {
      const config = await getConfig();

      const table: Table = new Table()
        .header(["Setting", "Value"])
        .body(Object.entries(config))
        .padding(2)
        .border(true);

      console.log(table.toString());
    } else {
      await setupConfig();
      console.log("Setup Complete");
    }
  });
