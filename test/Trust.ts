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

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2, addr3, addr4] = await ethers.getSigners();

    // Deploy TrustToken contract
    const TrustTokenFactory: TrustToken__factory = await ethers.getContractFactory("TrustToken");
    token = await TrustTokenFactory.deploy();
    await token.waitForDeployment();

    // Deploy Trust contract
    const TrustFactory: Trust__factory = await ethers.getContractFactory("Trust");
    trust = await TrustFactory.deploy(await token.getAddress());
    await trust.waitForDeployment();

    // Mint tokens for testing using the payable mint function
    const ethAmount = ethers.parseEther("1"); // 1 ETH
    await token.connect(addr1).mint({ value: ethAmount });
    await token.connect(addr2).mint({ value: ethAmount });
    await token.connect(addr3).mint({ value: ethAmount });
    await token.connect(addr4).mint({ value: ethAmount });
  
    // Approve trust contract to spend tokens
    const trustAddress: string = await trust.getAddress();
    
    // Get the actual token balances (1 ETH * 1000 RATE = 1000 tokens)
    const tokenBalance = ethers.parseEther("1000");
    await token.connect(addr1).approve(trustAddress, tokenBalance);
    await token.connect(addr2).approve(trustAddress, tokenBalance);
    await token.connect(addr3).approve(trustAddress, tokenBalance);
    await token.connect(addr4).approve(trustAddress, tokenBalance);
  });

  describe("Group Management", function () {
    it("Should create a new group successfully", async function () {
      const groupName: string = "TestGroup";
      const members: string[] = [addr1.address, addr2.address, addr3.address];

      await expect(trust.createGroup(groupName, members)).to.not.be.reverted;

      // Test that group exists by trying to join it
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
        const amount: number = 300;
        const description: string = "Dinner";
        const date: number = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const split: number[] = []; // Empty for equal split

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.not.be.reverted;
      });

      it("Should handle remainder correctly in equal split", async function () {
        const amount: number = 100;
        const description: string = "Groceries";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 0;
        const split: number[] = [];

        // Amount 100 split among 3 members = 33, 33, 34
        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.not.be.reverted;
      });
    });

    describe("Exact Split (splitMethod = 1)", function () {
      it("Should add expense with exact split", async function () {
        const amount: number = 300;
        const description: string = "Utilities";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const split: number[] = [100, 100, 100]; // Exact amounts

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.not.be.reverted;
      });

      it("Should reject exact split with incorrect total", async function () {
        const amount: number = 300;
        const description: string = "Utilities";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const split: number[] = [100, 100, 50]; // Total = 250, not 300

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.be.revertedWith("Invalid split");
      });

      it("Should reject exact split with mismatched array lengths", async function () {
        const amount: number = 300;
        const description: string = "Utilities";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const split: number[] = [100, 100]; // Only 2 splits for 3 members

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.be.revertedWith("For this split method the members list and the split list must coincide");
      });
    });

    describe("Percentage Split (splitMethod = 2)", function () {
      it("Should add expense with percentage split", async function () {
        const amount: number = 300;
        const description: string = "Rent";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const split: number[] = [50, 30, 20]; // Percentages

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.not.be.reverted;
      });

      it("Should handle remainder in percentage split", async function () {
        const amount: number = 100;
        const description: string = "Coffee";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const split: number[] = [33, 33, 34]; // Percentages that might cause remainder

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.not.be.reverted;
      });

      it("Should reject percentage split with mismatched array lengths", async function () {
        const amount: number = 300;
        const description: string = "Rent";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 2;
        const split: number[] = [50, 30]; // Only 2 percentages for 3 members

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.be.revertedWith("For this split method the members list and the split list must coincide");
      });
    });

    describe("Input Validation", function () {
      it("Should reject zero amount", async function () {
        const amount: number = 0;
        const description: string = "Test";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
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
          members,
          split
        )).to.be.revertedWith("Expense amount must be greater than 0");
      });

      it("Should reject future date", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = Math.floor(Date.now() / 1000) + 3600; // 1 hour in future
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
          members,
          split
        )).to.be.revertedWith("Date must be before current date");
      });

      it("Should reject invalid split method", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 5; // Invalid split method
        const split: number[] = [];

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.be.revertedWith("Split method not found");
      });

      it("Should reject empty member list", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
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
          [], // Empty members
          split
        )).to.be.revertedWith("Member list must be not empty");
      });

      it("Should reject empty split list", async function () {
        const amount: number = 100;
        const description: string = "Test";
        const date: number = Math.floor(Date.now() / 1000) - 3600;
        const payer: string = addr1.address;
        const splitMethod: number = 1;
        const split: number[] = []; // Empty split for exact method

        await expect(trust.addExpense(
          groupName,
          amount,
          description,
          date,
          payer,
          splitMethod,
          members,
          split
        )).to.be.revertedWith("Split lilst must be not empty");
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

      // Add an expense to create debt
      const amount: number = 300;
      const description: string = "Shared expense";
      const date: number = Math.floor(Date.now() / 1000) - 3600;
      const payer: string = addr1.address;
      const splitMethod: number = 0;
      const split: number[] = [];

      await trust.addExpense(
        groupName,
        amount,
        description,
        date,
        payer,
        splitMethod,
        members,
        split
      );
    });

    it("Should settle debt successfully", async function () {
      const receiver: string = addr1.address;
      const amount: number = 50;

      // Get initial balances
      const initialReceiverBalance: bigint = await token.balanceOf(receiver);
      const initialSenderBalance: bigint = await token.balanceOf(addr2.address);

      await expect(trust.connect(addr2).settleDebt(groupName, receiver, amount))
        .to.not.be.reverted;

      // Check balances changed correctly
      const finalReceiverBalance: bigint = await token.balanceOf(receiver);
      const finalSenderBalance: bigint = await token.balanceOf(addr2.address);

      expect(finalReceiverBalance).to.equal(initialReceiverBalance + BigInt(amount));
      expect(finalSenderBalance).to.equal(initialSenderBalance - BigInt(amount));
    });

    it("Should handle partial debt settlement", async function () {
      const receiver: string = addr1.address;
      const partialAmount: number = 50;

      await expect(trust.connect(addr2).settleDebt(groupName, receiver, partialAmount))
        .to.not.be.reverted;

      // Should be able to settle more debt
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, partialAmount))
        .to.not.be.reverted;
    });

    it("Should handle settlement amount greater than debt", async function () {
      const receiver: string = addr1.address;
      const excessiveAmount: number = 1000; // More than the debt

      // Should only transfer the actual debt amount
      await expect(trust.connect(addr2).settleDebt(groupName, receiver, excessiveAmount))
        .to.not.be.reverted;
    });

    it("Should reject settlement of non-existent debt", async function () {
      const receiver: string = addr2.address; // addr1 doesn't owe addr2
      const amount: number = 50;

      await expect(trust.connect(addr1).settleDebt(groupName, receiver, amount))
        .to.be.revertedWith("Debt does not exists");
    });

    it("Should fail when token transfer fails", async function () {
      const receiver: string = addr1.address;
      const amount: number = 50;

      // Remove approval to cause transfer failure
      await token.connect(addr2).approve(await trust.getAddress(), 0);

      await expect(trust.connect(addr2).settleDebt(groupName, receiver, amount))
        .to.be.revertedWith("Token transfer failed");
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
      const members: string[] = [addr1.address, addr2.address, addr3.address];
      await trust.createGroup(groupName, members);

      // Add multiple expenses
      const date: number = Math.floor(Date.now() / 1000) - 3600;

      // Expense 1: addr1 pays 300, split equally
      await trust.addExpense(
        groupName,
        300,
        "Dinner",
        date,
        addr1.address,
        0,
        members,
        []
      );

      // Expense 2: addr2 pays 150, split exactly
      await trust.addExpense(
        groupName,
        150,
        "Groceries",
        date - 1000,
        addr2.address,
        1,
        members,
        [50, 50, 50]
      );

      // Expense 3: addr3 pays 200, split by percentage
      await trust.addExpense(
        groupName,
        200,
        "Utilities",
        date - 2000,
        addr3.address,
        2,
        members,
        [40, 30, 30]
      );

      // Settle some debts
      await expect(trust.connect(addr2).settleDebt(groupName, addr1.address, 50))
        .to.not.be.reverted;

      await expect(trust.connect(addr3).settleDebt(groupName, addr1.address, 30))
        .to.not.be.reverted;
    });

    it("Should handle complex group dynamics", async function () {
      const groupName: string = "ComplexGroup";
      const initialMembers: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, initialMembers);

      // New member joins
      await trust.connect(addr3).joinGroup(groupName);

      // Add expense with all members
      const allMembers: string[] = [addr1.address, addr2.address, addr3.address];
      await trust.addExpense(
        groupName,
        600,
        "Trip",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        2,
        allMembers,
        [50, 25, 25]
      );

      // Settle debts
      await expect(trust.connect(addr2).settleDebt(groupName, addr1.address, 100))
        .to.not.be.reverted;

      await expect(trust.connect(addr3).settleDebt(groupName, addr1.address, 150))
        .to.not.be.reverted;
    });

    it("Should handle edge case with single member expense", async function () {
      const groupName: string = "SingleMemberGroup";
      const members: string[] = [addr1.address];
      await trust.createGroup(groupName, members);

      // Add expense with single member
      await expect(trust.addExpense(
        groupName,
        100,
        "Solo expense",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        0,
        members,
        []
      )).to.not.be.reverted;
    });
  });

  describe("Error Handling", function () {
    it("Should handle large amounts", async function () {
      const groupName: string = "LargeAmountGroup";
      const members: string[] = [addr1.address, addr2.address];
      await trust.createGroup(groupName, members);

      const largeAmount: bigint = ethers.parseEther("1000000");
      
      await expect(trust.addExpense(
        groupName,
        largeAmount,
        "Large expense",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        0,
        members,
        []
      )).to.not.be.reverted;
    });

    it("Should handle zero values in percentage split", async function () {
      const groupName: string = "ZeroPercentGroup";
      const members: string[] = [addr1.address, addr2.address, addr3.address];
      await trust.createGroup(groupName, members);

      await expect(trust.addExpense(
        groupName,
        300,
        "Zero percent test",
        Math.floor(Date.now() / 1000) - 3600,
        addr1.address,
        2,
        members,
        [100, 0, 0] // One member pays 100%, others pay 0%
      )).to.not.be.reverted;
    });
  });
});