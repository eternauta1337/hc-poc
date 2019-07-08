const spawn = require('child_process').spawn;

module.exports = function pocketh(...args) {
  return new Promise((resolve, reject) => {
    // const pocketh = spawn(`pocketh ${command}`, args);
    const pocketh = spawn(`pocketh`, args);

    pocketh.stdout.on('data', data => {
      console.log(`  ${data.toString()}`);
    });

    pocketh.stderr.on('data', data => {
      console.log(`  ${data.toString()}`);
    });

    pocketh.on('exit', code => {
      console.log(`  pocketh exited with code ${code}`);
      if(code === 0) resolve();
      if(code >= 1) reject();
    });
  });
};
