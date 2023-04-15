import { assertEquals } from "std/testing/asserts.ts";
import {
  clean,
  cleanFilename,
  cleanPath,
  removeTrailingSlash,
} from "./utils.ts";

Deno.test("utils/removeTrailingSlash", () => {
  assertEquals(
    removeTrailingSlash("with/trailing/slash/"),
    "with/trailing/slash",
  );
  assertEquals(
    removeTrailingSlash("with/trailing/slash"),
    "with/trailing/slash",
  );
});

Deno.test("utils/clean", () => {
  assertEquals(
    clean("A.B_C Ab1 `~!@#$%^&*(){}[]-_=+\\|;:'\",.<>/?"),
    "A B C Ab1",
  );
});

Deno.test("utils/cleanFilename", () => {
  assertEquals(
    cleanFilename("Ab1 !%&(){}[]-',. `~@#$^*_=+\\|;:\"<>/?"),
    "Ab1 !%&(){}[]-',.",
  );
});

Deno.test("utils/cleanPath", () => {
  assertEquals(
    cleanPath("Ab1 !%&(){}[]-',. `~@#$^*_=+\\|;:\"<>/?"),
    "Ab1 !%&(){}[]-',.",
  );
});
