// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./ERC721Tradable.sol";

// *************************************************
//    _____   ___________    .___
//   /  _  \  \_   _____/  __| _/  ____    ____
//  /  /_\  \  |    __)_  / __ |  / ___\ _/ __ \
// /    |    \ |        \/ /_/ | / /_/  >\  ___/
// \____|__  //_______  /\____ | \___  /  \___  >
//         \/         \/      \//_____/       \/
// **************************************************

contract AEdgeAdobotsGen1 is ERC721Tradable, IERC2981, ReentrancyGuard {
    using Strings for uint256;

    constructor(
        address _withdrawAddress,
        address _proxyRegistryAddress,
        address _royaltyReceiver,
        uint256 _royaltyPercentage
    )
        ERC721Tradable("AEdge Adobots Generation One", "AEdgeAdobotsGen1", _proxyRegistryAddress)
    {
        require(_royaltyReceiver != address(0), "Invalid receiver address");
        require(_royaltyPercentage <= ROYALTY_MAX, "Royalty is above max value");

        ROYALTY_PERCENTAGE = _royaltyPercentage;
        ROYALTY_RECEIVER = _royaltyReceiver;
        WITHDRAW_ADDRESS = _withdrawAddress;
    }

    uint256 private MAX_SUPPLY = 8192;
    uint256 private MAX_PER_WALLET = 6;
    uint256 private immutable MINT_PRICE = 0.02 ether;
    uint256 private immutable WHITELIST_PRICE = 0.01 ether;

    bytes32 private MERKLE_ROOT;

    bool private MINTING_CLOSED = false;
    bool private MINTING_ENABLED = false;
    bool private WHITELIST_ENABLED = false;

    uint256 public constant ROYALTY_MAX = 1000; // 10%
    address public immutable ROYALTY_RECEIVER;
    uint256 public immutable ROYALTY_PERCENTAGE;
    address public immutable WITHDRAW_ADDRESS;

    string private baseURI = "ipfs://";

    mapping(address => uint256) private _mintedTokens;

    function whitelistMint(uint256 num, bytes32[] calldata merkleProof) external nonReentrant payable returns (uint256) {
        require(isMintingEnabled(), 'Minting is not enabled');
        require(isWhitelistEnabled(), 'Whitelist period is over');
        _bulkRequire(num, WHITELIST_PRICE);

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(merkleProof, MERKLE_ROOT, leaf),
            "Your address is not whitelisted"
        );

        _safeMint(msg.sender, num);
        _mintedTokens[msg.sender] += num;

        return _totalMinted();
    }

    function payToMint(uint256 num) external nonReentrant payable returns (uint256) {
        require(isMintingEnabled(), 'Minting is not enabled');
        require(!isWhitelistEnabled(), 'Only whitelist can mint');
        _bulkRequire(num, MINT_PRICE);

        _safeMint(msg.sender, num);
        _mintedTokens[msg.sender] += num;

        return _totalMinted();
    }

    function ownerMint(uint256 num, address to) external onlyOwner returns (uint256) {
        require(_totalMinted() + (num - 1) < MAX_SUPPLY, 'Maximum number of tokens minted');

        _safeMint(to, num);
        _mintedTokens[msg.sender] += num;

        return _totalMinted();
    }

    function _bulkRequire(uint256 num, uint256 mintPrice) internal {
        require(msg.value >= (mintPrice * num), 'Not enough ether provided to mint!');
        require(_totalMinted() + (num - 1) < MAX_SUPPLY, 'Maximum number of tokens minted');
        require(num <= (MAX_PER_WALLET - _mintedTokens[msg.sender]), 'Max mints per wallet reached');
    }

    function setBaseURI(string memory _newBaseURI) external onlyOwner {
        baseURI = _newBaseURI;
    }

    function closeMinting() external onlyOwner {
        MINTING_CLOSED = true;
    }

    function isWhitelisted(address _address, bytes32[] calldata merkleProof) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));

        return MerkleProof.verify(merkleProof, MERKLE_ROOT, leaf);
    }

    function isWhitelistEnabled() public view returns (bool) {
        return WHITELIST_ENABLED;
    }

    function isMintingEnabled() public view returns (bool) {
        return MINTING_ENABLED && !MINTING_CLOSED;
    }

    function getMaxSupply() external view returns (uint256) {
        return MAX_SUPPLY;
    }

    function getMaxPerWallet() external view returns (uint256) {
        return MAX_PER_WALLET;
    }

    function setMaxPerWallet(uint256 maxPerWalletValue) external onlyOwner {
        MAX_PER_WALLET = maxPerWalletValue;
    }

    function getMerkleRoot() external view returns (bytes32) {
        return MERKLE_ROOT;
    }

    function setMerkleRoot(bytes32 newMerkleRoot) external onlyOwner {
        MERKLE_ROOT = newMerkleRoot;
    }

    function setNewMaxSupply(uint256 newMaxSupply) external onlyOwner {
        require(newMaxSupply <= 8192, 'New max supply can not be over 8192');
        require(newMaxSupply >= count(), 'New max must be greater than current supply');

        MAX_SUPPLY = newMaxSupply;
    }

    function setWhitelistEnabled(bool whitelistEnabledValue) external onlyOwner {
        WHITELIST_ENABLED = whitelistEnabledValue;
    }

    function setMintingEnabled(bool mintingEnabledValue) external onlyOwner {
        MINTING_ENABLED = mintingEnabledValue;
    }

    function count() public view returns (uint256) {
        return totalSupply();
    }

    function getAddressTokens(address _address) external view returns (uint256[] memory) {
        uint256[] memory tokenIds = new uint256[](count());
        uint256 c = 0;
        for (uint256 i = 1; i < count() + 1; i++)
        {
            if (ownerOf(i) == _address) {
                tokenIds[c] = i;
                c++;
            }
        }

        uint256 f = 0;
        for (uint256 i = 0; i < tokenIds.length; i++)
        {
            if (tokenIds[i] > 0) {
                f++;
            }
        }

        uint256[] memory myTokenIds = new uint256[](f);
        c = 0;
        for (uint256 i = 0; i < tokenIds.length; i++)
        {
            if (tokenIds[i] > 0) {
                myTokenIds[c] = tokenIds[i];
                c++;
            }
        }

        return myTokenIds;
    }


    function getTokenHolders() external view returns (address[] memory) {
        address[] memory tokenHolders = new address[](count());
        uint256 c = 0;
        for (uint256 i = 1; i < count() + 1; i++)
        {
            tokenHolders[c] = ownerOf(i);
            c++;
        }

        return tokenHolders;
    }


    function withdrawAll() external onlyOwner returns(bool)
    {
        (bool sent, bytes memory data) = WITHDRAW_ADDRESS.call{value: address(this).balance}("");
        require(sent, "WITHDRAW_FAILED");

        return sent;
    }

    /**
     * @dev Interface implementation for the NFT Royalty Standard (ERC-2981).
   * Called by marketplaces that supports the standard with the sale price to determine how much royalty is owed and
   * to whom.
   * The first parameter tokenId (the NFT asset queried for royalty information) is not used as royalties are
   * calculated equally for all tokens.
   * @param salePrice - the sale price of the NFT asset specified by `tokenId`
   * @return receiver - address of who should be sent the royalty payment
   * @return royaltyAmount - the royalty payment amount for `salePrice`
   */
    function royaltyInfo(uint256, uint256 salePrice) external view override returns (address, uint256) {
        return (ROYALTY_RECEIVER, (salePrice * ROYALTY_PERCENTAGE) / ROYALTY_MAX);
    }


    function _startTokenId() internal view override returns (uint256) {
        return 1;
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721A, IERC165) returns (bool) {
        return ERC721A.supportsInterface(interfaceId);
    }
}
