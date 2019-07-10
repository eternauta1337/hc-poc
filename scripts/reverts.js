module.exports = async (promise, errorMessage) => {
    let error;
    try {
        await promise;
    }
    catch(e) { error = e }
    const includesError = error.message.includes(errorMessage);
    if(includesError) return true;
    console.log(`Received error: ${error.message}`);
    return false;
};
