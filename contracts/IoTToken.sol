// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract IoTToken is ERC20, Ownable {
    constructor() ERC20("IoT Security Token", "ISEC") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }

    // Fungsi tambahan jika ingin menambah supply koin di masa depan
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}