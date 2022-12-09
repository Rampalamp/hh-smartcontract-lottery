const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 LINK per request, it is the premium to use the oracle.
const GAS_PRICE_LINK = 1e9; //calculated value based on the gas price of the chain

//price of request changes based on the price of gas for the blockchain.

module.exports = async function ({ getNamedAccounts, deployment }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [BASE_FEE, GAS_PRICE_LINK];
    //const chainId = network.config.chainId;

    if (developmentChains.includes(network.name)) {
        log("local network detected, deploying mocks...");

        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        });

        log("Mocks deployed.");

        log("--------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
