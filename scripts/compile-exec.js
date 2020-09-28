const os = require('os');
const path = require('path');
const { compileExec } = require('@mongosh/build');
const config = require(path.join(__dirname, '..', 'config', 'build.conf.js'));

const run = async() => {
  console.log(`node --version ${process.version}`);

  let { signableExecutable } = config;
  if (process.argv.includes('--no-signable'))
    signableExecutable = false;
  if (process.argv.includes('--signable'))
    signableExecutable = true;

  await compileExec(
    config.input,
    config.execInput,
    config.outputDir,
    config.execNodeVersion,
    signableExecutable,
    config.analyticsConfig,
    config.segmentKey
  );
};

run().then(
  () => process.exit(0),
  (err) => process.nextTick(() => { throw err; }));
