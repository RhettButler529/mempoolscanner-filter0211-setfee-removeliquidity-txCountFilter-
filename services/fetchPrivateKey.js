const crypto = require("crypto");
const Algorithm = "aes-128-ecb";
const fs = require("fs");


async function decryptFile(key, inputFile) {
    const inputData = fs.readFileSync(inputFile);
    const cipher = crypto.createDecipheriv(Algorithm, key, Buffer.alloc(0));
    const output = Buffer.concat([cipher.update(inputData) , cipher.final()]);
    return output
}



module.exports = {decryptFile}