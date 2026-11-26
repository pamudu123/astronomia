import base from "./playwright.config";

export default { ...base, webServer: [(base.webServer as object[])[0]] };
