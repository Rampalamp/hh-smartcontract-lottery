const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");

const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");
//in the staging tests you would normally want to hit testnets etc, but the code is generally left untouched minus anything to do with VRFCoordinatorV2

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let raffle, raffleEntranceFee, deployer;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              //await deployments.fixture(["all"]);

              raffle = await ethers.getContract("Raffle", deployer);
              //   vrfCoordinatorV2Mock = await ethers.getContract(
              //       "VRFCoordinatorV2Mock",
              //       deployer
              //   );
              raffleEntranceFee = await raffle.getEntranceFee();
              //interval = await raffle.getIntervalSeconds();
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  //enter raffle
                  const startingTimeStamp = await raffle.getLatestTimeStamp();
                  const accounts = await ethers.getSigners();
                  //setup listener before we enter the raffle, incase the blockchain moves fast
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired.");

                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerEndingBalance =
                                  await accounts[0].getBalance();
                              const endingTimeStamp =
                                  await raffle.getLatestTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address
                              );
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(raffleEntranceFee)
                                      .toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }

                          resolve();
                      });

                      //now we can enter the raffle once listener is setup
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                      const winnerStartingBalance =
                          await accounts[0].getBalance();
                  });
              });
          });
      });
