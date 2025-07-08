# Start the localhost node
npx hardhat node

# Compile the smart contracts
npx hardhat compile --network localhost

# Deploy the module on the local node
npx hardhat ignition deploy ./ignition/modules/Trust.ts --network localhost