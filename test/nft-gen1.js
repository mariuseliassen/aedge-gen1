const { expect } = require("chai");
const { ethers } = require("hardhat");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");

const token = "AEdgeAdobotsGen1";

const RINKEBY_PROXY = "0x1E525EEAF261cA41b809884CBDE9DD9E1619573A";
const MAINNET_PROXY = "0xa5409ec958c83c3f309868babaca7c86dcb077c1";

describe(token + " tests", function () {
  let myToken;
  let whitelistAddreses = [];

  // `beforeEach` will run before each test, re-deploying the contract every
  // time. It receives a callback, which can be async.
  beforeEach(async function () {
    const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const myTokenFactory = await ethers.getContractFactory(token);
    myToken = await myTokenFactory.deploy();
    await myToken.deployed();

    const enableMinting = await myToken.setMintingEnabled(true);
    await enableMinting.wait();

    whitelistAddreses = [addr2.address, addr4.address];
  });

  it("Should mint one", async function () {
    const minter = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

    let balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(0);

    const newlyMintedToken = await myToken.payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken.wait();

    balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(1);

    const addressTokens = await myToken.getAddressTokens(minter);

    expect(addressTokens.length).to.equal(1);
    expect(addressTokens[0].toNumber()).to.equal(1);
  });

  it("Should transfer one", async function () {
    const minter = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
    const recipient = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    let balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(0);

    const newlyMintedToken = await myToken.payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken.wait();

    balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(1);

    balance = await myToken.balanceOf(recipient);
    expect(balance).to.equal(0);

    const transferToken = await myToken.transferFrom(minter, recipient, "1");
    await transferToken.wait();

    balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(0);

    const addressTokens = await myToken
        .connect(minter)
        .getAddressTokens(minter);

    expect(addressTokens.length).to.equal(0);

    balance = await myToken.balanceOf(recipient);
    expect(balance).to.equal(1);

    const addressTokens2 = await myToken
        .connect(recipient)
        .getAddressTokens(recipient);

    expect(addressTokens2.length).to.equal(1);
    expect(addressTokens2[0].toNumber()).to.equal(1);
  });

  it("Can not mint above MAX_SUPPLY", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const newMaxSupplySet = await myToken.connect(owner).setNewMaxSupply(5);
    await newMaxSupplySet.wait();

    let balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(0);

    const newlyMintedToken = await myToken
        .connect(addr1)
        .payToMint(3, { value: ethers.utils.parseEther("0.06") });
    await newlyMintedToken.wait();
    balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(3);

    const newlyMintedToken2 = await myToken
        .connect(addr2)
        .payToMint(2, { value: ethers.utils.parseEther("0.04") });
    await newlyMintedToken2.wait();
    balance = await myToken.balanceOf(addr2.address);
    expect(balance).to.equal(2);

    await expect(
        myToken
            .connect(addr2)
            .payToMint(1, { value: ethers.utils.parseEther("0.02") })
    ).to.be.revertedWith("Maximum number of tokens minted");
  });

  it("Bulk mint", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();

    let balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(0);

    let newlyMintedToken = await myToken
        .connect(addr1)
        .payToMint(2, { value: ethers.utils.parseEther("0.04") });
    await newlyMintedToken.wait();
    balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(2);

    let addressTokens = await myToken
        .connect(addr1)
        .getAddressTokens(addr1.address);

    expect(addressTokens.length).to.equal(2);
    expect(addressTokens[0].toNumber()).to.equal(1);
    expect(addressTokens[1].toNumber()).to.equal(2);

    newlyMintedToken = await myToken
        .connect(addr2)
        .payToMint(1, { value: ethers.utils.parseEther("0.02") });
    await newlyMintedToken.wait();
    balance = await myToken.balanceOf(addr2.address);
    expect(balance).to.equal(1);

    addressTokens = await myToken
        .connect(addr2)
        .getAddressTokens(addr2.address);

    expect(addressTokens.length).to.equal(1);
    expect(addressTokens[0].toNumber()).to.equal(3);

    newlyMintedToken = await myToken
        .connect(addr1)
        .payToMint(1, { value: ethers.utils.parseEther("0.02") });
    await newlyMintedToken.wait();
    balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(3);

    addressTokens = await myToken
        .connect(addr1)
        .getAddressTokens(addr1.address);

    expect(addressTokens.length).to.equal(3);
    expect(addressTokens[2].toNumber()).to.equal(4);
  });

  it("Enable minting", async function () {
    const enableMinting = await myToken.setMintingEnabled(true);
    await enableMinting.wait();

    const mintingEnabled = await myToken.isMintingEnabled();
    expect(mintingEnabled).to.equal(true);

    await expect(
        myToken.payToMint(1, { value: ethers.utils.parseEther("0.02") })
    ).to.be.ok;
  });

  it("Disable minting", async function () {
    const disableMinting = await myToken.setMintingEnabled(false);
    await disableMinting.wait();

    const mintingEnabled = await myToken.isMintingEnabled();
    expect(mintingEnabled).to.equal(false);

    await expect(
        myToken.payToMint(1, { value: ethers.utils.parseEther("0.02") })
    ).to.be.reverted;
  });

  it("Set merkle root", async function () {
    const leafNodes = whitelistAddreses.map((addr) => keccak256(addr));
    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });
    const rootHash = merkleTree.getRoot();

    const setMerkleTree = await myToken.setMerkleRoot(rootHash);
    await setMerkleTree.wait();
  });

  it("Only whitelist can mint", async function () {
    const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    const leafNodes = whitelistAddreses.map((addr) => keccak256(addr));
    const merkleTree = new MerkleTree(leafNodes, keccak256, {
      sortPairs: true,
    });

    const rootHash = merkleTree.getRoot();

    const setMerkleTree = await myToken.setMerkleRoot(rootHash);
    await setMerkleTree.wait();

    let balance = await myToken.connect(addr2).balanceOf(addr2.address);
    expect(balance).to.equal(0);

    await expect(
        myToken
            .connect(addr1)
            .whitelistMint(1, merkleTree.getHexProof(keccak256(addr1.address)), {
              value: ethers.utils.parseEther("0.01"),
            })
    ).to.be.revertedWith("Your address is not whitelisted");

    const whitelistMint = await myToken
        .connect(addr2)
        .whitelistMint(1, merkleTree.getHexProof(leafNodes[0]), {
          value: ethers.utils.parseEther("0.01"),
        });
    await whitelistMint.wait();

    balance = await myToken.connect(addr2).balanceOf(addr2.address);
    expect(balance).to.equal(1);

    const whitelistMint2 = await myToken
        .connect(addr4)
        .whitelistMint(1, merkleTree.getHexProof(leafNodes[1]), {
          value: ethers.utils.parseEther("0.01"),
        });
    await whitelistMint2.wait();

    balance = await myToken.connect(addr4).balanceOf(addr4.address);
    expect(balance).to.equal(1);
  });

  it("Can not mint with wrong price", async function () {
    const minter = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

    const balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(0);

    await expect(
        myToken.payToMint(2, { value: ethers.utils.parseEther("0.01") })
    ).to.be.revertedWith("Incorrect amount of ether provided for the mint!");
  });

  it("Can not mint above max per wallet", async function () {
    const minter = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

    const balance = await myToken.balanceOf(minter);
    expect(balance).to.equal(0);

    const maxPerWallet = await myToken.maxPerWallet();

    await expect(
        myToken.payToMint(maxPerWallet.toNumber() + 1, {
          value: ethers.utils.parseEther("0.14"),
        })
    ).to.be.revertedWith("Max mints per wallet reached");

    const newlyMintedToken = await myToken.payToMint(
        maxPerWallet.toNumber() - 1,
        {
          value: ethers.utils.parseEther("0.10"),
        }
    );
    await newlyMintedToken.wait();

    const newlyMintedToken2 = await myToken.payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken2.wait();

    await expect(
        myToken.payToMint(1, { value: ethers.utils.parseEther("0.02") })
    ).to.be.revertedWith("Max mints per wallet reached");
  });

  it("Withdraw all from owner should be ok", async function () {
    const [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    let balance = await addr3.getBalance();
    expect(balance).to.equal(ethers.utils.parseEther("10000"));

    const newlyMintedToken = await myToken.connect(addr1).payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken.wait();

    const withdrawAll = await myToken.withdrawAll();
    await withdrawAll.wait();

    balance = await addr3.getBalance();
    expect(balance).to.equal(ethers.utils.parseEther("10000.02"));
  });

  it("Withdraw all from non-owner should fail", async function () {
    const [owner, addr1] = await ethers.getSigners();

    await expect(myToken.connect(addr1).withdrawAll()).to.be.revertedWith(
        "Ownable: caller is not the owner"
    );
  });

  it("Close mint", async function () {
    const [owner, addr1] = await ethers.getSigners();

    const closeMinting = await myToken.closeMinting();
    await closeMinting.wait();

    await expect(
        myToken.payToMint(1, {
          value: ethers.utils.parseEther("0.02"),
        })
    ).to.be.revertedWith("Minting is not enabled");
  });

  it("Owner mint to address", async function () {
    const [owner, addr1] = await ethers.getSigners();

    let balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(0);

    const newlyMintedToken = await myToken.ownerMint(2, addr1.address);
    await newlyMintedToken.wait();

    balance = await myToken.balanceOf(addr1.address);
    expect(balance).to.equal(2);
  });

  it("Only owner can ownerMint()", async function () {
    const [owner, addr1] = await ethers.getSigners();

    await expect(
        myToken.connect(addr1).ownerMint(1, addr1.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("Should return all tokenHolders()", async function () {
    const [owner, addr1, addr2] = await ethers.getSigners();

    const newlyMintedToken = await myToken.connect(addr1).payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken.wait();

    const newlyMintedToken2 = await myToken.connect(addr2).payToMint(1, {
      value: ethers.utils.parseEther("0.02"),
    });
    await newlyMintedToken2.wait();

    const tokenHolders = await myToken.getTokenHolders();

    expect(tokenHolders.length).to.be.equal(2);
    expect(tokenHolders[0]).to.be.equal(addr1.address);
    expect(tokenHolders[1]).to.be.equal(addr2.address);
  });

  it("Should return mintSettings()", async function () {
    const [owner] = await ethers.getSigners();

    const mintSettings = await myToken.getMintSettings();

    expect(mintSettings.maxSupply.toNumber()).to.be.equal(4096);
    expect(mintSettings.maxPerWallet.toNumber()).to.be.equal(6);
    expect(mintSettings.mintPrice).to.be.equal(ethers.utils.parseEther("0.02"));
    expect(mintSettings.whitelistPrice).to.be.equal(
        ethers.utils.parseEther("0.01")
    );
  });

  it("Should change mintPrice() and whitelistPrice()", async function () {
    const [owner] = await ethers.getSigners();

    await myToken.setMintPrice(
        ethers.utils.parseEther("0.2"),
        ethers.utils.parseEther("0.1")
    );

    const mintSettings = await myToken.getMintSettings();

    expect(mintSettings.mintPrice).to.be.equal(ethers.utils.parseEther("0.2"));
    expect(mintSettings.whitelistPrice).to.be.equal(
        ethers.utils.parseEther("0.1")
    );
  });
});
