import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Trust, TrustToken, Trust__factory, TrustToken__factory } from "../typechain-types";

describe("Trust Contract", function () {
  let trust: Trust;
  let token: TrustToken;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;
  let addr4: SignerWithAddress;
  let currentTimestamp: number;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();
    const TrustTokenFactory: TrustToken__factory = await ethers.getContractFactory("TrustToken");
    token = await TrustTokenFactory.deploy();
    await token.waitForDeployment();
    const TrustFactory: Trust__factory = await ethers.getContractFactory("Trust");
    trust = await TrustFactory.deploy(await token.getAddress());
    await trust.waitForDeployment();
    const ethAmount = ethers.parseEther("1");
    await token.connect(addr1).mint({ value: ethAmount });
    await token.connect(addr2).mint({ value: ethAmount });
    await token.connect(addr3).mint({ value: ethAmount });
    await token.connect(addr4).mint({ value: ethAmount });
    const trustAddress: string = await trust.getAddress();
    const tokenBalance = ethers.parseEther("1000");
    await token.connect(addr1).approve(trustAddress, tokenBalance);
    await token.connect(addr2).approve(trustAddress, tokenBalance);
    await token.connect(addr3).approve(trustAddress, tokenBalance);
    await token.connect(addr4).approve(trustAddress, tokenBalance);
    const currentBlock = await ethers.provider.getBlock('latest');
    currentTimestamp = currentBlock!.timestamp;
  });

  describe("Group Management", function () {
    it("Should create a new group successfully", async function () {
      const groupName: string = "TestGroup";
      const members: string[] = [addr1.address, addr2.address, addr3.address];
      await expect(trust.createGroup(groupName, members)).to.not.be.reverted;
      await expect(trust.connect(addr4).joinGroup(groupName)).to.not.be.reverted;
    });

    it("Should not create a group with duplicate name", async function () {
      const groupName: string = "TestGroup";
      const members: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, members);
      await expect(trust.createGroup(groupName, members)).to.be.revertedWith("Group already exists");
    });

    it("Should allow user to join an existing group", async function () {
      const groupName: string = "TestGroup";
      const members: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, members);
      await expect(trust.connect(addr3).joinGroup(groupName)).to.not.be.reverted;
    });

    it("Should not allow user to join non-existent group", async function () {
      await expect(trust.connect(addr1).joinGroup("NonExistentGroup")).to.be.revertedWith("Group does not exists");
    });

    it("Should not allow user to join group twice", async function () {
      const groupName: string = "TestGroup";
      const members: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, members);
      await expect(trust.connect(addr1).joinGroup(groupName)).to.be.revertedWith("Member already joined");
    });
  });

  describe("Expense Management", function () {
    let groupName: string;
    let members: string[];

    beforeEach(async function () {
      groupName = "ExpenseGroup";
      members = [addr1.address, addr2.address, addr3.address];
      await trust.createGroup(groupName, members);
    });

    describe("Equal Split (splitMethod = 0)", function () {
      it("Should add expense with equal split", async function () {
        const amount: number = 200;
        const description: string = "Dinner";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.not.be.reverted;
      });

      it("Should handle remainder correctly in equal split", async function () {
        const amount: number = 201;
        const description: string = "Groceries";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.not.be.reverted;
      });
    });

    describe("Exact Split (splitMethod = 1)", function () {
      it("Should add expense with exact split", async function () {
        const amount: number = 200;
        const description: string = "Utilities";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [100, 100];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.not.be.reverted;
      });

      it("Should reject exact split with incorrect total", async function () {
        const amount: number = 200;
        const description: string = "Utilities";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [100, 50];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("Invalid split");
      });

      it("Should reject exact split with mismatched array lengths", async function () {
        const amount: number = 200;
        const description: string = "Utilities";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [200];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("For this split method the debtor list and the split list must have the same length");
      });
    });

    describe("Percentage Split (splitMethod = 2)", function () {
      it("Should add expense with percentage split", async function () {
        const amount: number = 200;
        const description: string = "Rent";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [80, 20];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.not.be.reverted;
      });

      it("Should handle remainder in percentage split", async function () {
        const amount: number = 50;
        const description: string = "Coffee";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [33, 67];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.not.be.reverted;
      });

      it("Should reject percentage split with mismatched array lengths", async function () {
        const amount: number = 200;
        const description: string = "Rent";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [100];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("For this split method the debtor list and the split list must have the same length");
      });
    });

    describe("Input Validation", function () {
      it("Should reject zero amount", async function () {
        const amount: number = 0;
        const description: string = "Test";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("Expense amount must be greater than 0");
      });

      it("Should reject future date", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = currentTimestamp + 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("Specified date must be before current date");
      });

      it("Should reject invalid split method", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 5;
        const debtors: string[] = [addr2.address, addr3.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("Split method not found");
      });

      it("Should reject empty debtor list", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          [],
          split
        )).to.be.revertedWith("Debtor list must be not empty");
      });

      it("Should reject debtor not exists", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = currentTimestamp - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const debtors: string[] = [addr2.address, addr3.address,addr4.address];
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          debtors,
          split
        )).to.be.revertedWith("A debtor does not exists");
      });
    });
  });

  describe("Debt Settlement", function () {
    let groupName: string;
    let members: string[];

    beforeEach(async function () {
      groupName = "DebtGroup";
      members = [addr1.address, addr2.address, addr3.address];
      await trust.createGroup(groupName, members);
      const amount: number = 200;
      const description: string = "Shared expense";
      const date: number = currentTimestamp - 3600;
      const payer: string = addr1.address;
      const splitMethod: number = 0;
      const debtors: string[] = [addr2.address, addr3.address];
      const split: number[] = [];

      await trust.addExpense(
        groupName,
        amount,
        description,
        date,
        payer,
        splitMethod,
        debtors,
        split
      );
    });

    it("Should settle debt successfully", async function () {
      const receiver: string = addr1.address;
      const amount: bigint = 50n;
      const initialReceiverBalance: bigint = await token.balanceOf(receiver);
      const initialSenderBalance: bigint = await token.balanceOf(addr2.address);
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, amount)).to.not.be.reverted;
      const finalReceiverBalance: bigint = await token.balanceOf(receiver);
      const finalSenderBalance: bigint = await token.balanceOf(addr2.address);
      expect(finalReceiverBalance).to.equal(initialReceiverBalance + amount);
      expect(finalSenderBalance).to.equal(initialSenderBalance - amount);
    });

    it("Should handle partial debt settlement", async function () {
      const receiver: string = addr1.address;
      const partialAmount: number = 50;
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, partialAmount)).to.not.be.reverted;
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, partialAmount)).to.not.be.reverted;
    });

    it("Should handle settlement amount greater than debt", async function () {
      const receiver: string = addr1.address;
      const excessiveAmount: number = 1000;
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, excessiveAmount)).to.not.be.reverted;
    });

    it("Should reject settlement of non-existent debt", async function () {
      const receiver: string = addr2.address;
      const amount: number = 50;
      await expect(trust.connect(addr1).settleDebt(groupName, receiver, amount)).to.be.revertedWith("Debt does not exists");
    });

    it("Should fail when token transfer fails", async function () {
      const receiver: string = addr1.address;
      const amount: number = 50;
      await token.connect(addr2).approve(await trust.getAddress(), 0);
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, amount)).to.be.revertedWith("Tokens transfer failed");
    });
  });

  describe("Token Integration", function () {
    it("Should verify token contract address", async function () {
      const tokenAddress: string = await trust.token();
      const actualTokenAddress: string = await token.getAddress();
      expect(tokenAddress).to.equal(actualTokenAddress);
    });

    it("Should handle token balance queries", async function () {
      const balance: bigint = await token.balanceOf(addr1.address);
      expect(balance).to.equal(ethers.parseEther("1000"));
    });

    it("Should handle token allowance queries", async function () {
      const trustAddress: string = await trust.getAddress();
      const allowance: bigint = await token.allowance(addr1.address, trustAddress);
      expect(allowance).to.equal(ethers.parseEther("1000"));
    });
  });

  describe("Integration Tests", function () {
    it("Should handle multiple expenses and settlements", async function () {
      const groupName: string = "IntegrationGroup";
      const members = [addr1.address, addr2.address, addr3.address];
      await trust.createGroup(groupName, members);
      const date: number = currentTimestamp - 3600;

      await trust.addExpense(
        groupName,
        200,
        "Dinner",
        date,
        addr1.address,
        0,
        [addr2.address, addr3.address],
        []
      );

      await trust.addExpense(
        groupName,
        100,
        "Groceries",
        date - 1000,
        addr2.address,
        1,
        [addr1.address, addr3.address],
        [50, 50]
      );

      await trust.addExpense(
        groupName,
        200,
        "Utilities",
        date - 2000,
        addr3.address,
        2,
        [addr1.address, addr2.address],
        [50, 50]
      );

      await expect(trust.connect(addr2).settleDebt(groupName, addr1.address, 50)).to.not.be.reverted;
      await expect(trust.connect(addr2).settleDebt(groupName, addr3.address, 30)).to.not.be.reverted;
    });

    it("Should handle complex group dynamics", async function () {
      const groupName: string = "ComplexGroup";
      const initialMembers: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, initialMembers);
      await trust.connect(addr3).joinGroup(groupName);
      const debtors: string[] = [addr2.address, addr3.address];

      await trust.addExpense(
        groupName,
        600,
        "Trip",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        2,
        debtors,
        [50, 50]
      );

      await expect(trust.connect(addr2).settleDebt(groupName, addr1.address, 100)).to.not.be.reverted;
      await expect(trust.connect(addr3).settleDebt(groupName, addr1.address, 150)).to.not.be.reverted;
    });

    it("Should handle edge case with single member expense", async function () {
      const groupName: string = "SingleMemberGroup";
      const members: string[] = [addr1.address, addr2.address];
      const debtors: string[] = [addr2.address];
      await trust.createGroup(groupName, members);

      await expect(trust.addExpense(
        groupName,
        100,
        "Solo expense",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        0,
        debtors,
        []
      )).to.not.be.reverted;
    });
  });

  describe("Error Handling", function () {
    it("Should handle large amounts", async function () {
      const groupName: string = "LargeAmountGroup";
      const members: string[] = [addr1.address, addr2.address];
      const debtors: string[] = [addr2.address];
      await trust.createGroup(groupName, members);
      const largeAmount: bigint = ethers.parseEther("1000000");
      
      await expect(trust.addExpense(
        groupName,
        largeAmount,
        "Large expense",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        0,
        debtors,
        []
      )).to.not.be.reverted;
    });

    it("Should handle zero values in percentage split", async function () {
      const groupName: string = "ZeroPercentGroup";
      const members: string[] = [addr1.address, addr2.address, addr3.address];
      const debtors: string[] = [addr2.address, addr3.address];
      await trust.createGroup(groupName, members);

      await expect(trust.addExpense(
        groupName,
        300,
        "Zero percent test",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        2,
        debtors,
        [100, 0]
      )).to.not.be.reverted;
    });
  });
});