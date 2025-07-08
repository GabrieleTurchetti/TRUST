# Start the localhost node
# npx hardhat node

sleep 1

# Compile the smart contracts
npx hardhat compile --network localhost

sleep 1

# Deploy the module on the local node
npx hardhat ignition deploy ./ignition/modules/Trust.ts --network localhost

sleep 1

# Executes all the tests
npx hardhat test --network localhost