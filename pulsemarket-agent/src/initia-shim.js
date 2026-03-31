import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const initia = require("@initia/initia.js");

export const { RESTClient, MnemonicKey, LCDClient, MsgExecute, Fee } = initia;
