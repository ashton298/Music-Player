// Ad-hoc signs the Mac app after packaging. There's no paid Apple certificate,
// but Apple Silicon Macs refuse to run apps with no signature at all (they show
// "damaged"), and merging the Intel and ARM builds breaks Electron's own signature.
const { execFileSync } = require("child_process");
const path = require("path");

exports.default = async function (context) {
  if (context.electronPlatformName !== "darwin") return;
  // Skip the separate Intel/ARM builds made on the way to a universal app;
  // signing them would make their files differ and break the merge.
  if (context.appOutDir.endsWith("-temp")) return;
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", app], { stdio: "inherit" });
};
