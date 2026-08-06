const batchRows = document.getElementById("batchRows");
const batchDuration = document.getElementById("batchDuration");
const createBatchBtn = document.getElementById("createBatch");
const batchStatus = document.getElementById("batchStatus");
const batchFeePreview = document.getElementById("batchFeePreview");

const customDurationRow = document.getElementById("customDurationRow");
const customDurationValue = document.getElementById("customDurationValue");
const customDurationUnit = document.getElementById("customDurationUnit");

const PLATFORM_FEE_BPS = 25; // 0.25%, must match PulsePay.sol

batchDuration.addEventListener("change", () => {
    customDurationRow.classList.toggle("visible", batchDuration.value === "custom");
});

function getBatchDurationSeconds() {
    if (batchDuration.value === "custom") {
        const val = Number(customDurationValue.value);
        if (!val || val <= 0) return null;
        return val * Number(customDurationUnit.value);
    }
    return Number(batchDuration.value);
}

function updateBatchFeePreview() {
    const lines = batchRows.value.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    let totalEth = 0;
    let validCount = 0;

    for (const line of lines) {
        const parts = line.split(",").map(p => p.trim());
        if (parts.length === 2 && ethers.utils.isAddress(parts[0]) && Number(parts[1]) > 0) {
            totalEth += Number(parts[1]);
            validCount++;
        }
    }

    if (validCount === 0) {
        batchFeePreview.textContent = "";
        return;
    }

    const fee = (totalEth * PLATFORM_FEE_BPS) / 10000;
    const net = totalEth - fee;
    batchFeePreview.textContent =
        `${validCount} recipient${validCount > 1 ? "s" : ""} \u00b7 total sent: ${totalEth.toFixed(8)} ETH \u2014 ` +
        `0.25% platform fee: ${fee.toFixed(8)} ETH \u2014 recipients stream ${net.toFixed(8)} ETH combined`;
}

batchRows.addEventListener("input", updateBatchFeePreview);

function onWalletConnected() {
    loadStreams();
}

function onWalletDisconnected() {
    clearStreamList("Connect your wallet to see your streams.");
}

function onWalletError() {
    batchStatus.textContent = "Could not connect wallet.";
    batchStatus.classList.add("error");
}

createBatchBtn.addEventListener("click", createBatch);

async function createBatch() {
    if (!contract) {
        batchStatus.textContent = "Connect your wallet first.";
        batchStatus.classList.add("error");
        return;
    }
    try {
        batchStatus.classList.remove("error");

        const lines = batchRows.value.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            batchStatus.textContent = "Add at least one recipient line.";
            batchStatus.classList.add("error");
            return;
        }

        const recipients = [];
        const amounts = [];
        let totalEth = 0;

        for (const line of lines) {
            const parts = line.split(",").map(p => p.trim());
            if (parts.length !== 2 || !ethers.utils.isAddress(parts[0]) || !parts[1] || Number(parts[1]) <= 0) {
                batchStatus.textContent = `Invalid line: "${line}". Use format: 0xAddress, amount`;
                batchStatus.classList.add("error");
                return;
            }
            recipients.push(parts[0]);
            amounts.push(ethers.utils.parseEther(parts[1]));
            totalEth += Number(parts[1]);
        }

        const durationSeconds = getBatchDurationSeconds();
        if (!durationSeconds) {
            batchStatus.textContent = "Enter a valid custom duration.";
            batchStatus.classList.add("error");
            return;
        }

        batchStatus.textContent = "Sending batch transaction...";
        const tx = await contract.createStreamBatch(recipients, amounts, durationSeconds, {
            value: ethers.utils.parseEther(totalEth.toString())
        });
        await tx.wait();

        batchStatus.textContent = `Batch sent to ${recipients.length} recipients.`;
        batchRows.value = "";
        batchFeePreview.textContent = "";
        loadStreams();
        if (typeof refreshBalance === "function") refreshBalance();
    } catch (err) {
        console.error(err);
        batchStatus.textContent = "Batch transaction failed.";
        batchStatus.classList.add("error");
    }
}
