document.addEventListener('DOMContentLoaded', () => {
    const refreshBtn = document.getElementById('refresh-btn');
    const tableBody = document.getElementById('threat-table-body');
    const tokenLedgerBody = document.getElementById('token-ledger-body');
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
                        severityBadge = '<span class="badge badge-critical">🚨 CRITICAL</span>';
                    } else if (dl === 3) {
                        severityBadge = '<span class="badge badge-high">🟠 HIGH</span>';
                    } else if (dl === 2) {
                        severityBadge = '<span class="badge badge-medium">🟡 MEDIUM</span>';
                    } else {
                        severityBadge = '<span class="badge badge-low">🔵 LOW</span>';
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
                        ❌ Failed to sync with blockchain. Node might be offline.
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
                tr.innerHTML = `
                    <td class="mono">#${entry.blockNumber}</td>
                    <td>${formattedDate}</td>
                    <td class="mono">${shortValue(entry.from)}</td>
                    <td class="mono">${shortValue(entry.to)}</td>
                    <td>${entry.value}</td>
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
        await Promise.all([fetchLogs(), fetchDashboardSummary(), fetchTokenLedger()]);
    });

    // Initial load
    Promise.all([fetchLogs(), fetchDashboardSummary(), fetchTokenLedger()]);
});
