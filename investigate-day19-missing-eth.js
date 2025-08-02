const { Web3 } = require('web3');
const fs = require('fs');

// Use public RPC endpoint
const web3 = new Web3('https://eth.llamarpc.com');

// Buy & Process contract
const BUY_PROCESS_ADDRESS = '0xaa390a37006e22b5775a34f2147f81ebd6a63641';

// The two transactions to investigate
const TX_HASHES = [
    '0x0b87e939008878822d0460e08d6ce114fd854c7471602361b306a968989ace30',
    '0xfc57bfeb9bf565de5fd4ebbc4d2a02c7f74623910ed48eb9acd230270068c74b'
];

async function investigateTransactions() {
    console.log('Investigating Day 19 transactions that show ETH value on-chain...\n');
    
    const results = [];
    
    for (const txHash of TX_HASHES) {
        console.log(`\n=== Investigating Transaction: ${txHash} ===`);
        
        try {
            // Get transaction details
            const tx = await web3.eth.getTransaction(txHash);
            console.log('\nTransaction Details:');
            console.log(`- From: ${tx.from}`);
            console.log(`- To: ${tx.to}`);
            console.log(`- Value: ${web3.utils.fromWei(tx.value, 'ether')} ETH`);
            console.log(`- Gas Price: ${web3.utils.fromWei(tx.gasPrice, 'gwei')} gwei`);
            console.log(`- Block Number: ${tx.blockNumber}`);
            
            // Get transaction receipt
            const receipt = await web3.eth.getTransactionReceipt(txHash);
            console.log(`\nTransaction Receipt:`);
            console.log(`- Status: ${receipt.status ? 'Success' : 'Failed'}`);
            console.log(`- Gas Used: ${receipt.gasUsed}`);
            console.log(`- Contract Address Interacted: ${tx.to}`);
            console.log(`- Number of Events: ${receipt.logs.length}`);
            
            // Initialize buyAndBuildEvents
            let buyAndBuildEvents = [];
            
            // Check if it's the Buy & Process contract
            if (tx.to && tx.to.toLowerCase() === BUY_PROCESS_ADDRESS.toLowerCase()) {
                console.log('\n✓ Transaction is to the Buy & Process contract');
                
                // Decode the input data
                console.log('\nDecoding transaction input...');
                console.log(`- Input data length: ${tx.input.length} characters`);
                console.log(`- Method ID: ${tx.input.slice(0, 10)}`);
                
                // Look for BuyAndBuild events
                buyAndBuildEvents = receipt.logs.filter(log => {
                    // BuyAndBuild event signature
                    const buyAndBuildSig = web3.utils.sha3('BuyAndBuild(address,uint256,uint256)');
                    return log.topics[0] === buyAndBuildSig;
                });
                
                console.log(`\nBuyAndBuild Events Found: ${buyAndBuildEvents.length}`);
                
                if (buyAndBuildEvents.length > 0) {
                    for (const event of buyAndBuildEvents) {
                        console.log('\nBuyAndBuild Event:');
                        console.log(`- Log Index: ${event.logIndex}`);
                        console.log(`- Transaction Index: ${event.transactionIndex}`);
                        
                        // Decode the event
                        try {
                            const decoded = web3.eth.abi.decodeLog(
                                [
                                    { type: 'address', name: 'user', indexed: true },
                                    { type: 'uint256', name: 'torusAmount', indexed: false },
                                    { type: 'uint256', name: 'titanAmount', indexed: false }
                                ],
                                event.data,
                                event.topics.slice(1)
                            );
                            
                            console.log(`- User: ${decoded.user}`);
                            console.log(`- Torus Amount: ${web3.utils.fromWei(decoded.torusAmount, 'ether')}`);
                            console.log(`- Titan Amount: ${web3.utils.fromWei(decoded.titanAmount, 'ether')}`);
                        } catch (decodeError) {
                            console.log(`- Error decoding event: ${decodeError.message}`);
                        }
                    }
                }
                
                // Also look for any Transfer events to track ETH flow
                const transferEvents = receipt.logs.filter(log => {
                    const transferSig = web3.utils.sha3('Transfer(address,address,uint256)');
                    return log.topics[0] === transferSig;
                });
                
                console.log(`\nTransfer Events Found: ${transferEvents.length}`);
            } else {
                console.log(`\n✗ Transaction is NOT to the Buy & Process contract`);
                console.log(`  Actual contract: ${tx.to}`);
            }
            
            // Get block timestamp
            const block = await web3.eth.getBlock(tx.blockNumber);
            const timestamp = Number(block.timestamp);
            const date = new Date(timestamp * 1000);
            console.log(`\nBlock Timestamp: ${date.toISOString()}`);
            console.log(`Protocol Day: ${Math.floor((timestamp - 1752086400) / 86400) + 1}`);
            
            results.push({
                txHash,
                from: tx.from,
                to: tx.to,
                value: web3.utils.fromWei(tx.value, 'ether'),
                blockNumber: tx.blockNumber,
                timestamp: timestamp,
                date: date.toISOString(),
                protocolDay: Math.floor((timestamp - 1752086400) / 86400) + 1,
                isBuyProcessContract: tx.to && tx.to.toLowerCase() === BUY_PROCESS_ADDRESS.toLowerCase(),
                methodId: tx.input.slice(0, 10),
                status: receipt.status,
                eventCount: receipt.logs.length,
                hasBuyAndBuildEvent: buyAndBuildEvents.length > 0
            });
            
        } catch (error) {
            console.error(`Error investigating transaction ${txHash}:`, error.message);
            results.push({
                txHash,
                error: error.message
            });
        }
    }
    
    // Save results (handle BigInt serialization)
    const outputFile = 'day19-missing-eth-investigation.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, (key, value) => {
        if (typeof value === 'bigint') {
            return value.toString();
        }
        return value;
    }, 2));
    console.log(`\n\nInvestigation results saved to ${outputFile}`);
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    for (const result of results) {
        if (!result.error) {
            console.log(`\nTransaction ${result.txHash}:`);
            console.log(`- ETH Value: ${result.value} ETH`);
            console.log(`- To Buy Process Contract: ${result.isBuyProcessContract ? 'YES' : 'NO'}`);
            console.log(`- Has BuyAndBuild Event: ${result.hasBuyAndBuildEvent ? 'YES' : 'NO'}`);
            console.log(`- Protocol Day: ${result.protocolDay}`);
            console.log(`- Method ID: ${result.methodId}`);
        }
    }
}

investigateTransactions().catch(console.error);