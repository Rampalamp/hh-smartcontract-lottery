//raffle

//enter the lottery (paying some amount)
//Pick a random winner(verifiably random)
//winner to be selected every X minutes --> completely automated

//chainlink oracle -> Randomness, automate execution

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

error Raffle_NotEnoughETHEntered();
error Raffle_TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(
    uint256 currentBalance,
    uint256 numPlayers,
    uint256 raffleState
);

/**@title A sample Raffle Contract
 * @author Rampalamp
 * @notice This contract is for creating an untamperable decentralized smart contract lottery.
 * @dev Implements Chainlink VRF v2 and Chainlink Keepers
 */
contract Raffle is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /* Type Declarations*/
    //Enums are basically uint256 but in a more explicit/readable fashion
    enum RaffleState {
        OPEN,
        CALCULATING
    } // uint256 0 = OPEN, uint256 1 = CALCULATING

    /* State Variables */
    uint256 private immutable i_entranceFee;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGaslimit;
    uint16 private constant REQUEST_CONFIRMATION = 3;
    uint32 private constant NUM_WORD = 1;
    address payable[] private s_players;
    /* Lottery Variables (technically still state variables) */
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_intervalSeconds;

    //we can use ENUM to manage states of a smart contract.

    /* Events */
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    constructor(
        address vrfCoordinatorV2, //contract address
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 intervalSeconds
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGaslimit = callbackGasLimit;
        //can also set enums like so -- both are the same resulting in OPEN
        //s_raffleState = RaffleState(0);
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_intervalSeconds = intervalSeconds;
    }

    /* Functions */
    function enterRaffle() public payable {
        if (msg.value < i_entranceFee) {
            revert Raffle_NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
        }
        s_players.push(payable(msg.sender));

        //events
        //Emit an event when we update a dynamic array or mapping
        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that the Chainlink Keerp nodes call
     * they look for the 'upKeepNeeded' to return true;
     * the following should be true in order to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player, and have some ETH
     * 3. Our subscription is funded with LINK. (you sign up for a subscription with chain link, and send the funds.)
     * 4. The lottery should be in an "open" state.
     */

    //for testing purposes we will make checkUpKeep public
    function checkUpkeep(
        bytes memory //checkData -- again we dont need to necessarily use/give this param a name if we arent using it, but we do need to add the types
    )
        public
        override
        returns (
            bool upkeepNeeded,
            bytes memory //performData
        )
    {
        bool isOpen = (RaffleState.OPEN == s_raffleState);
        //block.timestamp - last block timestamp
        bool timePassed = ((block.timestamp - s_lastTimeStamp) >
            i_intervalSeconds);

        bool hasPlayers = (s_players.length > 0);

        upkeepNeeded = (isOpen && timePassed && hasPlayers);

        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(
        bytes calldata //checkdata
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");

        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            );
        }

        //request the random number
        //once we get it, do something with it.
        //2 transaction process.
        s_raffleState = RaffleState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane, //GAS LANE - store this value in the contract and set it in the constructor.
            i_subscriptionId,
            REQUEST_CONFIRMATION,
            i_callbackGaslimit, //
            NUM_WORD
        );
        //this event/emit is redundant, since in our VRFMock it has an event/emits a requestId which we would just grab from our VRF Mock after requestRandomWords is called.
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, //we arent using the requestId parameter so we can just input the type we expect, but not give it a name to get rid of warnings.
        uint256[] memory randomWords
    ) internal override {
        //random word could be something huge 129385909682386092384069823409682309648
        //so we can use the modulo to make sure the number is within our array size
        uint256 indexOfWinner = randomWords[0] % s_players.length;

        address payable recentWinner = s_players[indexOfWinner];

        s_recentWinner = recentWinner;

        (bool success, ) = recentWinner.call{value: address(this).balance}("");

        if (!success) {
            revert Raffle_TransferFailed();
        }
        //open the RaffleState after the balance has been transfered out
        //not 100% sure if there is an actual risk here of someone entering the raffle between the state being set to OPEN and the .call happening...
        s_raffleState = RaffleState.OPEN;
        //reset players array
        s_players = new address payable[](0);

        s_lastTimeStamp = block.timestamp;

        emit WinnerPicked(recentWinner);
    }

    /* View/Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getRaffleState() public view returns (RaffleState) {
        return s_raffleState;
    }

    //since NUM_WORD is a constant and therefore written into the BYTE CODE, we can make it as pure
    function getNumWords() public pure returns (uint256) {
        return NUM_WORD;
    }

    function getNumberOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getLatestTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getRequestConfirmations() public pure returns (uint256) {
        return REQUEST_CONFIRMATION;
    }

    function getIntervalSeconds() public view returns (uint256) {
        return i_intervalSeconds;
    }
}
