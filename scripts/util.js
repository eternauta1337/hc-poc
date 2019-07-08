const getWeb3 = require('../scripts/getWeb3.js');
const web3 = getWeb3('localhost');

module.exports = {
    skipTime: function(seconds) {
        return new Promise((resolve, reject) => {
            web3.currentProvider.send({
                jsonrpc: '2.0',
                method: 'evm_increaseTime',
                params: [seconds],
            }, (error, res) => {
                if(error) reject();
                else resolve(res);
            });
        });
    },
};
