const { assert, expect } = require("chai");
const { getNamedAccounts, deployments, ethers, network } = require("hardhat");

const {
    developmentChains,
    networkConfig,
} = require("../../helper-hardhat-config");
//in the describe blocks, it won't actually get recognized as an ASYNC function, so async is not necessary, but also won't break the tests.
!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle", function () {
          let raffle,
              vrfCoordinatorV2Mock,
              raffleEntranceFee,
              deployer,
              interval;

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]);

              raffle = await ethers.getContract("Raffle", deployer);
              vrfCoordinatorV2Mock = await ethers.getContract(
                  "VRFCoordinatorV2Mock",
                  deployer
              );
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getIntervalSeconds();
          });

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  //generally we want to make our tests have just 1 assert per "it"
                  const raffleState = await raffle.getRaffleState();

                  assert.equal(raffleState.toString(), "0", "Raffle State");
                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["intervalSeconds"],
                      "interval seconds"
                  );
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle_NotEnoughETHEntered"
                  );
              });
              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event on enter", async function () {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.emit(raffle, "RaffleEnter");
              });
              it("doesnt allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);

                  //pretend to be chainlink keeper
                  await raffle.performUpkeep([]);
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee })
                  ).to.be.revertedWith("Raffle__NotOpen");
              });
          });
          describe("checkUpkeep", function () {
              it("returns false if people havn't sent any ETH", async function () {
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);

                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );

                  assert(!upkeepNeeded);
              });

              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  await raffle.performUpkeep([]);

                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );

                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });

              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  //minus 1 wasn't cutting it, had to minus a bit moarrrr
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() - 10,
                  ]);
                  await network.provider.send("evm_mine", []);

                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      []
                  );

                  assert(!upkeepNeeded);
              });

              it("returns true if enough time has passed, has players, eth and is open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  //we can also call methods from our provider using the .request method.
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  // await network.provider.send("evm_mine", []);
                  //hardhat interprets 0x as a nothing or null data.
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep(
                      "0x"
                  );

                  assert(upkeepNeeded);
              });
          });
          describe("performUpkeep", function () {
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  //if performUpkeep errors out with Raffle_UpkeepNotNeeded it will essentially return a false in the tx constant which we can assert.
                  const tx = await raffle.performUpkeep([]);
                  assert(tx);
              });
              it("reverts when checkUpkeep is false", async function () {
                  //hardhat will know that the error Raffle__UpkeepNotNeeded reverts with data, and we can extrapolate it out for more specific tests.
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep([]);
                  const txReceipt = await txResponse.wait(1);
                  //since the vrf mock emits an event on requestRandomWords, our event/emittion will be in the second index, or 1.
                  const requestId = txReceipt.events[1].args.requestId;
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() === "1");
              });
          });
          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [
                      interval.toNumber() + 1,
                  ]);
                  await network.provider.send("evm_mine", []);
              });

              it("can only be called after performUpkeep", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                  ).to.be.revertedWith("nonexistent request");
              });

              //way too long of a test, generally speaking.
              it("picks a winner, resets the lottery, and sends money", async function () {
                  const additionalEntrants = 3;
                  const startingAccountIndex = 1; // deployer = 0
                  const accounts = await ethers.getSigners();
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(
                          accounts[i]
                      );
                      await accountConnectedRaffle.enterRaffle({
                          value: raffleEntranceFee,
                      });
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp();

                  //performUpkeep (mock being chainlink keepers)
                  //fulfillRandomWords (mock being the chainlink VRF)
                  //we will have to wait for the fulfillRandomWords to be called

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("Event initiated");
                          try {
                              const recentWinner =
                                  await raffle.getRecentWinner();
                              console.log(recentWinner);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[2].address);
                              console.log(accounts[3].address);

                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp =
                                  await raffle.getLatestTimeStamp();
                              const numPlayers =
                                  await raffle.getNumberOfPlayers();
                              const winnerEndingBalance =
                                  await accounts[1].getBalance();
                              assert.equal(numPlayers.toString(), "0");
                              assert.equal(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimeStamp);
                              console.log(winnerEndingBalance.toString());
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee)
                                          .toString()
                                  )
                              );
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });
                      //setting up the listener

                      //below we will fire the event, and the listener will pick it up, and resolve.
                      const tx = await raffle.performUpkeep([]);
                      const txReceipt = await tx.wait(1);
                      const winnerStartingBalance =
                          await accounts[1].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      );
                  });
              });
          });
      });
