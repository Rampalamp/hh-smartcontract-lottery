const { ethers } = require("hardhat");

const networkConfig = {
    4: {
        name: "goerli",
        vrfCoordinatorV2: "TESTNETVRFCoordinatorV2AddressGoesHere.",
        entranceFee: ethers.utils.parseEther("0.1"),
        gasLane:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "GetOffChainLinkUIOrDeployProgrammatically",
        callbackGasLimit: "500000",
        intervalSeconds: "30",
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.1"),
        gasLane:
            "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "ProgrammaticallyCreateInDeployscript",
        callbackGasLimit: "500000",
        intervalSeconds: "30",
    },
};

const developmentChains = ["hardhat", "localhost"];

module.exports = {
    networkConfig,
    developmentChains,
};
