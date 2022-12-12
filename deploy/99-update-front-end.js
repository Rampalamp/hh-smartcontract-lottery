const { ethers, network } = require("hardhat");
const fs = require("fs");

const {
    frontEndContractsFile,
    frontEndAbiFile,
} = require("../helper-hardhat-config");

module.exports = async function () {
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...");
        updateContractAddresses();
        updateABI();
    }
};

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle");
    //dont need the coordinator mock because it is only the raffle that contract that needs to talk to it.
    const chainId = network.config.chainId.toString();
    const currentAddresses = JSON.parse(
        fs.readFileSync(frontEndContractsFile, "utf-8")
    );

    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            currentAddresses[chainId].push(raffle.address);
        }
    } else {
        //if it doesnt already exist, add it to the json file with chainID as the key.
        currentAddresses[chainId] = [raffle.address];
    }

    fs.writeFileSync(frontEndContractsFile, JSON.stringify(currentAddresses));
}

async function updateABI() {
    const raffle = await ethers.getContract("Raffle");

    fs.writeFileSync(
        frontEndAbiFile,
        raffle.interface.format(ethers.utils.FormatTypes.json)
    );
}

module.exports.tags = ["all", "frontend"];
