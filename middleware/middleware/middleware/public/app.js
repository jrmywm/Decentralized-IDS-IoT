document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const tableBody = document.getElementById('threat-table-body');
    const tokenLedgerBody = document.getElementById('token-ledger-body');
    const stakedNodesBody = document.getElementById('staked-nodes-body');
    const pendingRewardsBody = document.getElementById('pending-rewards-body');
    const totalThreatsCounter = document.getElementById('total-threats-counter');
    const criticalCounter = document.getElementById('critical-counter');
    const blockNumber = document.getElementById('block-number');
    const blockHash = document.getElementById('block-hash');
    const blockTimestamp = document.getElementById('block-timestamp');
    const blockTxCount = document.getElementById('block-tx-count');
    const contractAddress = document.getElementById('contract-address');
    const contractNetwork = document.getElementById('contract-network');
    const contractChainId = document.getElementById('contract-chain-id');
    const contractTotalLogs = document.getElementById('contract-total-logs');
    const reporterAddress = document.getElementById('reporter-address');
    const reporterBalance = document.getElementById('reporter-balance');
    const reporterTxCount = document.getElementById('reporter-tx-count');
    const reporterLastTx = document.getElementById('reporter-last-tx');

    async function fetchLogs() {
        // UI Loading state
        refreshBtn.classList.add('syncing');
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-state">
                    <div class="spinner"></div>
                    <p>Querying decentralized ledger...</p>
                </td>
            </tr>
        `;

        try {
            const response = await fetch('/api/logs');
            if (!response.ok) throw new Error('API fetch failed');
            
            const logs = await response.json();
            
            // Render logs
            tableBody.innerHTML = '';
            
            if (logs.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No threat records found in the ledger.</td></tr>`;
            } else {
                let criticalCount = 0;

                logs.forEach(log => {
                    const dl = parseInt(log.dangerLevel);
                    if (dl >= 4) criticalCount++;

                    let severityBadge = '';
                    if (dl >= 4) {
                        severityBadge = '<span class="badge badge-critical">CRITICAL</span>';
                    } else if (dl === 3) {
                        severityBadge = '<span class="badge badge-high">HIGH</span>';
                    } else if (dl === 2) {
                        severityBadge = '<span class="badge badge-medium">MEDIUM</span>';
                    } else {
                        severityBadge = '<span class="badge badge-low">LOW</span>';
                    }

                    const date = new Date(parseInt(log.timestamp) * 1000).toLocaleString();

                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="mono">#${log.id}</td>
                        <td>${date}</td>
                        <td class="mono">${log.deviceId}</td>
                        <td class="mono">${log.attackerIP}</td>
                        <td>${log.attackType}</td>
                        <td>${severityBadge}</td>
                    `;
                    tableBody.appendChild(tr);
                });

                // Update Metrics Counters
                // We fetch the number from the API response length, but if you want true total, we can use an endpoint, 
                // but since /api/logs returns the latest logs, we can just display the length for now, 
                // or if it was > 50, it limits it. Here we just show the array length.
                animeCounter(totalThreatsCounter, logs.length);
                animeCounter(criticalCounter, criticalCount);
            }
        } catch (error) {
            console.error(error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-state" style="color: var(--danger);">
                        [Error] Failed to sync with blockchain. Node might be offline.
                    </td>
                </tr>
            `;
        } finally {
            refreshBtn.classList.remove('syncing');
        }
    }

    async function fetchDashboardSummary() {
        try {
            const response = await fetch('/api/dashboard-summary');
            if (!response.ok) throw new Error('Summary API fetch failed');
            const summary = await response.json();

            const block = summary.currentBlock || {};
            const contract = summary.smartContract || {};
            const reporter = summary.lastHoneypotReporter;

            blockNumber.textContent = block.number ?? '--';
            blockHash.textContent = shortValue(block.hash);
            blockTimestamp.textContent = block.timestamp ? new Date(Number(block.timestamp) * 1000).toLocaleString() : '--';
            blockTxCount.textContent = block.txCount ?? '--';

            contractAddress.textContent = shortValue(contract.address);
            contractNetwork.textContent = contract.network ?? '--';
            contractChainId.textContent = contract.chainId ?? '--';
            contractTotalLogs.textContent = contract.totalThreatLogs ?? '--';

            if (reporter) {
                reporterAddress.textContent = shortValue(reporter.address);
                reporterBalance.textContent = Number(reporter.balanceEth).toFixed(4);
                reporterTxCount.textContent = reporter.transactionCount ?? '--';
                reporterLastTx.textContent = shortValue(reporter.lastSubmissionTxHash);
            } else {
                reporterAddress.textContent = 'No reporter yet';
                reporterBalance.textContent = '--';
                reporterTxCount.textContent = '--';
                reporterLastTx.textContent = '--';
            }
        } catch (error) {
            console.error(error);
        }
    }

    async function fetchTokenLedger() {
        tokenLedgerBody.innerHTML = `
            <tr>
                <td colspan="6" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading IoTToken transfer ledger...</p>
                </td>
            </tr>
        `;

        try {
            const response = await fetch('/api/token-ledger');
            if (!response.ok) throw new Error('Token ledger API fetch failed');
            const data = await response.json();
            const ledger = data.ledger || [];

            tokenLedgerBody.innerHTML = '';
            if (ledger.length === 0) {
                tokenLedgerBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No IoTToken transfer entries found.</td></tr>`;
                return;
            }

            ledger.forEach((entry) => {
                const tr = document.createElement('tr');
                const formattedDate = entry.timestamp ? new Date(Number(entry.timestamp) * 1000).toLocaleString() : '--';
                
                // Highlight Dynamic Rewards
                let valueDisplay = entry.value;
                const numValue = parseFloat(entry.value);
                if (numValue >= 25) {
                    valueDisplay = `<span class="badge badge-critical" style="background: rgba(239, 68, 68, 0.2); border: 1px solid var(--danger); font-weight: bold; padding: 4px 8px; border-radius: 4px;">${entry.value} ISEC (Dynamic Reward)</span>`;
                    tr.style.backgroundColor = "rgba(239, 68, 68, 0.05)";
                } else if (numValue >= 5 && numValue < 25) {
                    valueDisplay = `<span class="badge badge-high" style="background: rgba(245, 158, 11, 0.2); border: 1px solid var(--warning); padding: 4px 8px; border-radius: 4px;">${entry.value} ISEC</span>`;
                }

                tr.innerHTML = `
                    <td class="mono">#${entry.blockNumber}</td>
                    <td>${formattedDate}</td>
                    <td class="mono">${shortValue(entry.from)}</td>
                    <td class="mono">${shortValue(entry.to)}</td>
                    <td>${valueDisplay}</td>
                    <td class="mono">${shortValue(entry.txHash)}</td>
                `;
                tokenLedgerBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            tokenLedgerBody.innerHTML = `
                <tr>
                    <td colspan="6" class="loading-state" style="color: var(--danger);">
                        Failed to load IoTToken ledger.
                    </td>
                </tr>
            `;
        }
    }

    async function fetchStakedNodes() {
        stakedNodesBody.innerHTML = `
            <tr>
                <td colspan="3" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading staked nodes from blockchain...</p>
                </td>
            </tr>
        `;

        try {
            const response = await fetch('/api/staked-nodes');
            if (!response.ok) throw new Error('Staked nodes API fetch failed');
            const nodes = await response.json();

            stakedNodesBody.innerHTML = '';
            if (nodes.length === 0) {
                stakedNodesBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 2rem;">No staked nodes found on the network.</td></tr>`;
                return;
            }

            nodes.forEach((node) => {
                const tr = document.createElement('tr');
                const balance = parseFloat(node.stakedBalance);
                
                let statusBadge = '<span class="badge badge-low">Verified</span>';
                if (balance < 100) {
                    statusBadge = '<span class="badge badge-critical">Slashed / Inactive</span>';
                    tr.style.opacity = "0.6";
                }

                tr.innerHTML = `
                    <td class="mono" style="font-weight: 600; color: var(--primary);">${node.address}</td>
                    <td style="font-family: 'Fira Code', monospace; font-size: 1.1rem;">${node.stakedBalance}</td>
                    <td>${statusBadge}</td>
                `;
                stakedNodesBody.appendChild(tr);
            });
        } catch (error) {
            console.error(error);
            stakedNodesBody.innerHTML = `
                <tr>
                    <td colspan="3" class="loading-state" style="color: var(--danger);">
                        Failed to load staked nodes.
                    </td>
                </tr>
            `;
        }
    }

    async function fetchPendingRewards() {
        if (!pendingRewardsBody) return;
        pendingRewardsBody.innerHTML = `
            <tr>
                <td colspan="5" class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading pending rewards...</p>
                </td>
            </tr>
        `;

        try {
            const [rewardsRes, summaryRes] = await Promise.all([
                fetch('/api/pending-rewards'),
                fetch('/api/dashboard-summary') // We need the current block to calculate unlock status
            ]);
            
            if (!rewardsRes.ok) throw new Error('Pending rewards API fetch failed');
            
            const rewards = await rewardsRes.json();
            const summary = await summaryRes.json();
            const currentBlock = summary.currentBlock ? summary.currentBlock.number : 0;

            pendingRewardsBody.innerHTML = '';
            
            if (rewards.length === 0) {
                pendingRewardsBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">No pending rewards locked in escrow.</td></tr>`;
                return;
            }

            rewards.forEach((reward) => {
                const tr = document.createElement('tr');
                const unlockBlock = parseInt(reward.unlockBlock);
                const isReady = currentBlock >= unlockBlock;
                
                let actionContent = '';
                if (isReady) {
                    actionContent = `<button class="btn-claim" data-log-id="${reward.logId}" style="background-color: var(--primary); color: #000; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: pointer;">Claim Reward</button>`;
                } else {
                    const blocksLeft = unlockBlock - currentBlock;
                    actionContent = `<button class="btn-locked" disabled style="background-color: #334155; color: #94a3b8; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; cursor: not-allowed;">[Locked] (${blocksLeft} blocks left)</button>`;
                }

                tr.innerHTML = `
                    <td class="mono">#${reward.logId}</td>
                    <td class="mono">${shortValue(reward.reporter)}</td>
                    <td style="font-weight: bold; color: var(--warning);">${reward.amount}</td>
                    <td class="mono">${reward.unlockBlock}</td>
                    <td>${actionContent}</td>
                `;
                pendingRewardsBody.appendChild(tr);
            });
            
            // Attach event listeners to claim buttons
            document.querySelectorAll('.btn-claim').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const logId = e.target.getAttribute('data-log-id');
                    const originalText = e.target.innerText;
                    e.target.innerText = "Claiming...";
                    e.target.disabled = true;
                    e.target.style.opacity = "0.7";
                    
                    try {
                        const res = await fetch('/api/claim-reward', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ logId })
                        });
                        const result = await res.json();
                        
                        if (result.success) {
                            e.target.innerText = "Claimed!";
                            e.target.style.backgroundColor = "var(--success)";
                            // Refresh dashboard
                            setTimeout(() => {
                                Promise.all([fetchLogs(), fetchDashboardSummary(), fetchTokenLedger(), fetchStakedNodes(), fetchPendingRewards()]);
                            }, 1000);
                        } else {
                            throw new Error(result.error || 'Claim failed');
                        }
                    } catch (err) {
                        console.error(err);
                        e.target.innerText = "Failed";
                        e.target.style.backgroundColor = "var(--danger)";
                        alert("Failed to claim reward: " + err.message);
                        setTimeout(() => {
                            e.target.innerText = originalText;
                            e.target.disabled = false;
                            e.target.style.opacity = "1";
                            e.target.style.backgroundColor = "var(--primary)";
                        }, 3000);
                    }
                });
            });

        } catch (error) {
            console.error(error);
            pendingRewardsBody.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-state" style="color: var(--danger);">
                        Failed to load pending rewards.
                    </td>
                </tr>
            `;
        }
    }

    // Simple counter animation
    function animeCounter(element, target) {
        let current = 0;
        const speed = 20; 
        const inc = Math.ceil(target / speed) || 1;
        
        const updateCount = () => {
            current += inc;
            if (current < target) {
                element.innerText = current;
                setTimeout(updateCount, 40);
            } else {
                element.innerText = target;
            }
        };
        updateCount();
    }

    function shortValue(value) {
        if (!value || typeof value !== 'string') return '--';
        if (value.length <= 16) return value;
        return `${value.slice(0, 8)}...${value.slice(-6)}`;
    }

    // Bind events
    refreshBtn.addEventListener('click', async () => {
        await Promise.all([fetchLogs(), fetchDashboardSummary(), fetchTokenLedger(), fetchStakedNodes(), fetchPendingRewards()]);
    });

    // Initial load
    Promise.all([fetchLogs(), fetchDashboardSummary(), fetchTokenLedger(), fetchStakedNodes(), fetchPendingRewards()]);
});
