import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Trust, TrustToken, Trust__factory, TrustToken__factory } from "../typechain-types";

describe("Trust Contract - Gas Usage Analysis", function () {
    let trust: Trust;
    let token: TrustToken;
    let owner: SignerWithAddress;
    let addr1: SignerWithAddress;
    let addr2: SignerWithAddress;
    let addr3: SignerWithAddress;
    let addr4: SignerWithAddress;
    let addr5: SignerWithAddress;
    let addr6: SignerWithAddress;
    let currentTimestamp: number;
    const gasUsage: { [key: string]: number[] } = {};

    const trackGasUsage = (functionName: string, gasUsed: number) => {
        if (!gasUsage[functionName]) {
            gasUsage[functionName] = [];
        }

        gasUsage[functionName].push(gasUsed);
    };

    const getGasStats = (functionName: string) => {
        const usage = gasUsage[functionName] || [];

        if (usage.length === 0) return {
            min: 0, max: 0, avg: 0, count: 0
        };
        
        const min = Math.min(...usage);
        const max = Math.max(...usage);
        const avg = Math.round(usage.reduce((a, b) => a + b, 0) / usage.length);
        return { min, max, avg, count: usage.length };
    };

    beforeEach(async function () {
        [owner, addr1, addr2, addr3, addr4, addr5, addr6] = await ethers.getSigners();
        const TrustTokenFactory: TrustToken__factory = await ethers.getContractFactory("TrustToken");
        token = await TrustTokenFactory.deploy();
        await token.waitForDeployment();
        const TrustFactory: Trust__factory = await ethers.getContractFactory("Trust");
        trust = await TrustFactory.deploy(await token.getAddress());
        await trust.waitForDeployment();
        const ethAmount = ethers.parseEther("1");
        const addresses = [addr1, addr2, addr3, addr4, addr5, addr6];

        for (const addr of addresses) {
            await token.connect(addr).mint({ value: ethAmount });
        }
        
        const trustAddress: string = await trust.getAddress();
        const tokenBalance = ethers.parseEther("10000");
        
        for (const addr of addresses) {
            await token.connect(addr).approve(trustAddress, tokenBalance);
        }
        
        const currentBlock = await ethers.provider.getBlock('latest');
        currentTimestamp = currentBlock!.timestamp;
    });

    describe("Group Management Gas Usage", function () {
        it("Should measure gas for createGroup with different member counts", async function () {
            const scenarios = [
                { name: "SmallGroup", members: [addr1.address, addr2.address] },
                { name: "MediumGroup", members: [addr1.address, addr2.address, addr3.address] },
                { name: "LargeGroup", members: [addr1.address, addr2.address, addr3.address, addr4.address, addr5.address] },
                { name: "XLargeGroup", members: [addr1.address, addr2.address, addr3.address, addr4.address, addr5.address, addr6.address] }
            ];

            for (const scenario of scenarios) {
                const tx = await trust.createGroup(scenario.name, scenario.members);
                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);
                trackGasUsage(`createGroup_${scenario.members.length}_members`, gasUsed);
                console.log(`Creating group with ${scenario.members.length} members: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for joinGroup", async function () {
            const groupName = "JoinTestGroup";
            const initialMembers = [addr1.address, addr2.address];
            await trust.createGroup(groupName, initialMembers);
            const tx = await trust.connect(addr3).joinGroup(groupName);
            const receipt = await tx.wait();
            const gasUsed = Number(receipt!.gasUsed);
            trackGasUsage("joinGroup", gasUsed);
            console.log(`Joining group: ${gasUsed} gas`);
        });
    });

    describe("Expense Management Gas Usage", function () {
        let groupName: string;
        let members: string[];

        beforeEach(async function () {
            groupName = "GasTestGroup";
            members = [addr1.address, addr2.address, addr3.address, addr4.address];
            await trust.createGroup(groupName, members);
        });

        it("Should measure gas for addExpense with equal split", async function () {
            const scenarios = [
                { debtors: [addr2.address], amount: 100 },
                { debtors: [addr2.address, addr3.address], amount: 200 },
                { debtors: [addr2.address, addr3.address, addr4.address], amount: 300 },
            ];

            for (const scenario of scenarios) {
                const tx = await trust.connect(addr1).addExpense(
                    groupName,
                    scenario.amount,
                    "Equal split test",
                    currentTimestamp - 3600,
                    addr1.address,
                    0,
                    scenario.debtors,
                    []
                );

                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);
                trackGasUsage(`addExpense_equalSplit_${scenario.debtors.length}_debtors`, gasUsed);
                console.log(`Equal split with ${scenario.debtors.length} debtors: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for addExpense with exact amount split", async function () {
            const scenarios = [
                { debtors: [addr2.address], split: [100], amount: 100 },
                { debtors: [addr2.address, addr3.address], split: [100, 100], amount: 200 },
                { debtors: [addr2.address, addr3.address, addr4.address], split: [100, 100, 100], amount: 300 },
            ];

            for (const scenario of scenarios) {
                const tx = await trust.connect(addr1).addExpense(
                    groupName,
                    scenario.amount,
                    "Exact split test",
                    currentTimestamp - 3600,
                    addr1.address,
                    1,
                    scenario.debtors,
                    scenario.split
                );

                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);
                trackGasUsage(`addExpense_exactSplit_${scenario.debtors.length}_debtors`, gasUsed);
                console.log(`Exact split with ${scenario.debtors.length} debtors: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for addExpense with percentage split", async function () {
            const scenarios = [
                { debtors: [addr2.address], split: [100], amount: 100 },
                { debtors: [addr2.address, addr3.address], split: [50, 50], amount: 200 },
                { debtors: [addr2.address, addr3.address, addr4.address], split: [33, 33, 34], amount: 300 },
            ];

            for (const scenario of scenarios) {
                const tx = await trust.connect(addr1).addExpense(
                    groupName,
                    scenario.amount,
                    "Percentage split test",
                    currentTimestamp - 3600,
                    addr1.address,
                    2,
                    scenario.debtors,
                    scenario.split
                );

                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);
                trackGasUsage(`addExpense_percentageSplit_${scenario.debtors.length}_debtors`, gasUsed);
                console.log(`Percentage split with ${scenario.debtors.length} debtors: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for addExpense with different amounts", async function () {
            const amounts = [10, 100, 1000, 10000, 100000];
            
            for (const amount of amounts) {
                const tx = await trust.connect(addr1).addExpense(
                    groupName,
                    amount,
                    `Amount test ${amount}`,
                    currentTimestamp - 3600,
                    addr1.address,
                    0,
                    [addr2.address, addr3.address],
                    []
                );

                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed); 
                trackGasUsage(`addExpense_amount_${amount}`, gasUsed);
                console.log(`Expense amount ${amount}: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for multiple expenses (graph complexity)", async function () {
            const expenseCount = 5;
            
            for (let i = 0; i < expenseCount; i++) {
                const tx = await trust.connect(addr1).addExpense(
                    groupName,
                    100,
                    `Sequential expense ${i + 1}`,
                    currentTimestamp - 3600 - (i * 60),
                    addr1.address,
                    0,
                    [addr2.address, addr3.address],
                    []
                );

                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);     
                trackGasUsage(`addExpense_sequential_${i + 1}`, gasUsed);
                console.log(`Sequential expense ${i + 1}: ${gasUsed} gas`);
            }
        });
    });

    describe("Debt Settlement Gas Usage", function () {
        let groupName: string;
        let members: string[];

        beforeEach(async function () {
            groupName = "DebtSettlementGroup";
            members = [addr1.address, addr2.address, addr3.address];
            await trust.createGroup(groupName, members);
            
            await trust.connect(addr1).addExpense(
                groupName,
                300,
                "Initial expense",
                currentTimestamp - 3600,
                addr1.address,
                0,
                [addr2.address, addr3.address],
                []
            );
        });

        it("Should measure gas for settleDebt with different amounts", async function () {
            const settlementAmounts = [10, 50, 100, 150];
            
            for (const amount of settlementAmounts) {
                await trust.connect(addr1).addExpense(
                    groupName,
                    200,
                    `Fresh debt ${amount}`,
                    currentTimestamp - 3600,
                    addr1.address,
                    0,
                    [addr2.address],
                    []
                );
                
                const tx = await trust.connect(addr2).settleDebt(groupName, addr1.address, amount);
                const receipt = await tx.wait();
                const gasUsed = Number(receipt!.gasUsed);
                trackGasUsage(`settleDebt_amount_${amount}`, gasUsed);
                console.log(`Settle debt amount ${amount}: ${gasUsed} gas`);
            }
        });

        it("Should measure gas for partial vs full debt settlement", async function () {
            await trust.connect(addr1).addExpense(
                groupName,
                200,
                "Partial settlement test",
                currentTimestamp - 3600,
                addr1.address,
                0,
                [addr2.address],
                []
            );
            
            const partialTx = await trust.connect(addr2).settleDebt(groupName, addr1.address, 100);
            const partialReceipt = await partialTx.wait();
            const partialGasUsed = Number(partialReceipt!.gasUsed);
            trackGasUsage("settleDebt_partial", partialGasUsed);
            console.log(`Partial debt settlement: ${partialGasUsed} gas`);
            const fullTx = await trust.connect(addr2).settleDebt(groupName, addr1.address, 100);
            const fullReceipt = await fullTx.wait();
            const fullGasUsed = Number(fullReceipt!.gasUsed);
            trackGasUsage("settleDebt_full", fullGasUsed);
            console.log(`Full debt settlement: ${fullGasUsed} gas`);
        });

        it("Should measure gas for settling debt with graph simplification", async function () {
            await trust.connect(addr2).addExpense(
                groupName,
                150,
                "Complex debt 1",
                currentTimestamp - 3600,
                addr2.address,
                0,
                [addr1.address, addr3.address],
                []
            );
            
            await trust.connect(addr3).addExpense(
                groupName,
                120,
                "Complex debt 2",
                currentTimestamp - 3600,
                addr3.address,
                0,
                [addr1.address, addr2.address],
                []
            );
            
            const tx = await trust.connect(addr2).settleDebt(groupName, addr1.address, 50);
            const receipt = await tx.wait();
            const gasUsed = Number(receipt!.gasUsed);
            trackGasUsage("settleDebt_with_simplification", gasUsed);
            console.log(`Settlement with graph simplification: ${gasUsed} gas`);
        });
    });

    describe("Comprehensive Gas Usage Scenarios", function () {
        it("Should measure gas for complete workflow", async function () {
            const workflowGroupName = "WorkflowGroup";
            const createTx = await trust.createGroup(workflowGroupName, [addr1.address, addr2.address]);
            const createReceipt = await createTx.wait();
            trackGasUsage("workflow_createGroup", Number(createReceipt!.gasUsed));
            const joinTx = await trust.connect(addr3).joinGroup(workflowGroupName);
            const joinReceipt = await joinTx.wait();
            trackGasUsage("workflow_joinGroup", Number(joinReceipt!.gasUsed));
            
            const expenseTx1 = await trust.connect(addr1).addExpense(
                workflowGroupName,
                300,
                "Dinner",
                currentTimestamp - 3600,
                addr1.address,
                0,
                [addr2.address, addr3.address],
                []
            );

            const expenseReceipt1 = await expenseTx1.wait();
            trackGasUsage("workflow_addExpense_1", Number(expenseReceipt1!.gasUsed));
            
            const expenseTx2 = await trust.connect(addr2).addExpense(
                workflowGroupName,
                200,
                "Groceries",
                currentTimestamp - 3600,
                addr2.address,
                1,
                [addr1.address, addr3.address],
                [100, 100]
            );
            
            const expenseReceipt2 = await expenseTx2.wait();
            trackGasUsage("workflow_addExpense_2", Number(expenseReceipt2!.gasUsed));
            const settleTx1 = await trust.connect(addr2).settleDebt(workflowGroupName, addr1.address, 50);
            const settleReceipt1 = await settleTx1.wait();
            trackGasUsage("workflow_settleDebt_1", Number(settleReceipt1!.gasUsed));
            const settleTx2 = await trust.connect(addr3).settleDebt(workflowGroupName, addr1.address, 75);
            const settleReceipt2 = await settleTx2.wait();
            trackGasUsage("workflow_settleDebt_2", Number(settleReceipt2!.gasUsed));
            console.log("Complete workflow gas usage tracked");
        });
        
        it("Should measure gas for stress test scenarios", async function () {
            const stressGroupName = "StressGroup";
            const largeGroup = [addr1.address, addr2.address, addr3.address, addr4.address, addr5.address, addr6.address];
            const createTx = await trust.createGroup(stressGroupName, largeGroup);
            const createReceipt = await createTx.wait();
            trackGasUsage("stress_createLargeGroup", Number(createReceipt!.gasUsed));
            const allDebtors = [addr2.address, addr3.address, addr4.address, addr5.address, addr6.address];

            const largeTx = await trust.connect(addr1).addExpense(
                stressGroupName,
                1000,
                "Large group expense",
                currentTimestamp - 3600,
                addr1.address,
                0,
                allDebtors,
                []
            );
            const largeReceipt = await largeTx.wait();
            trackGasUsage("stress_largeExpense", Number(largeReceipt!.gasUsed));
            
            for (let i = 0; i < allDebtors.length; i++) {
                const signer = [addr2, addr3, addr4, addr5, addr6][i];
                const settleTx = await trust.connect(signer).settleDebt(stressGroupName, addr1.address, 100);
                const settleReceipt = await settleTx.wait();
                trackGasUsage(`stress_settlement_${i + 1}`, Number(settleReceipt!.gasUsed));
            }
            
            console.log("Stress test scenarios completed");
        });
    });

    after(function () {
        console.log("\n=== GAS USAGE SUMMARY ===");
        const sortedFunctions = Object.keys(gasUsage).sort();
        const groupFunctions = sortedFunctions.filter(f => f.includes('createGroup') || f.includes('joinGroup'));
        console.log("\nGroup Management:");

        groupFunctions.forEach(f => {
            const stats = getGasStats(f);
            console.log(`  ${f}: ${stats.avg} gas (avg)`);
        });
        
        const expenseFunctions = sortedFunctions.filter(f => f.includes('addExpense'));
        console.log("\nExpense Management:");

        expenseFunctions.forEach(f => {
            const stats = getGasStats(f);
            console.log(`  ${f}: ${stats.avg} gas (avg)`);
        });
        
        const settlementFunctions = sortedFunctions.filter(f => f.includes('settleDebt'));
        console.log("\nDebt Settlement:");
        
        settlementFunctions.forEach(f => {
            const stats = getGasStats(f);
            console.log(`  ${f}: ${stats.avg} gas (avg)`);
        });
        
        console.log("\n=== END GAS ANALYSIS ===");
    });
});