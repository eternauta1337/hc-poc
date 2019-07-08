module.exports = async (promise, errorMessage) => {
    let error;
    try {
        await promise;
    }
    catch(e) { error = e }
    if(error.message.includes(errorMessage)) return true;
    return false;
};
