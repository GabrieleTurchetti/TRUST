import { ethers } from "hardhat";
import { expect } from "chai";
import { Trust, TrustToken } from "../typechain-types";

describe("Trust Contract", function () {
  let trust: Trust;
  let trustToken: TrustToken;
  let owner: any;
  let addr1: any;
  let addr2: any;
  let addr3: any;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3] = await ethers.getSigners();

    const TrustToken = await ethers.getContractFactory("TrustToken");
    trustToken = await TrustToken.deploy();
    await trustToken.waitForDeployment();

    const Trust = await ethers.getContractFactory("Trust");
    trust = await Trust.deploy(trustToken.getAddress());
    await trust.waitForDeployment();
  });

  it("should create a new group with given members", async function () {
    const groupName = "Weekend Trip";
    const members = [addr1.address, addr2.address, addr3.address];

    // Call createGroup
    await trust.createGroup(groupName, members);

    // Verify that group now exists — we can only verify indirectly since 'groups' is private
    // So we'll try to call joinGroup again, which should now fail for an existing member
    await expect(trust.connect(addr1).joinGroup(groupName)).to.be.revertedWith("Member already joined");

    // Try to create same group again — should revert
    await expect(trust.createGroup(groupName, members)).to.be.revertedWith("Group already exists");

    // Try to let a new user join
    await trust.connect(owner).joinGroup(groupName); // Should work for a new member
  });
});
