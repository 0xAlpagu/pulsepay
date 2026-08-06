const duration = document.getElementById("duration");
const amount = document.getElementById("amount");
const recipient = document.getElementById("recipient");
const createStreamBtn = document.getElementById("createStream");
const status = document.getElementById("status");
const feePreview = document.getElementById("feePreview");

const customDurationRowSingle = document.getElementById("customDurationRowSingle");
const customDurationValueSingle = document.getElementById("customDurationValueSingle");
const customDurationUnitSingle = document.getElementById("customDurationUnitSingle");

const PLATFORM_FEE_BPS = 25; // 0.25%, must match PulsePay.sol

duration.addEventListener("change", () => {
    customDurationRowSingle.classList.toggle("visible", duration.value === "custom");
});

function getSingleDurationSeconds() {
    if (duration.value === "custom") {
        const val = Number(customDurationValueSingle.value);
        if (!val || val <= 0) return null;
        return val * Number(customDurationUnitSingle.value);
    }
    return Number(duration.value);
}

function updateFeePreview() {
    const val = Number(amount.value);
    if (!val || val <= 0) {
        feePreview.textContent = "";
        return;
    }
    const fee = (val * PLATFORM_FEE_BPS) / 10000;
    const net = val - fee;
    feePreview.textContent =
        `0.25% platform fee: ${fee.toFixed(8)} ETH \u2014 recipient streams ${net.toFixed(8)} ETH`;
}

amount.addEventListener("input", updateFeePreview);

function onWalletConnected() {
    loadStreams();
}

function onWalletDisconnected() {
    clearStreamList("Connect your wallet to see your streams.");
}

function onWalletError() {
    status.textContent = "Could not connect wallet.";
    status.classList.add("error");
}

createStreamBtn.addEventListener("click", createStream);

async function createStream() {
    if (!contract) {
        status.textContent = "Connect your wallet first.";
        status.classList.add("error");
        return;
    }
    try {
        status.classList.remove("error");

        if (!ethers.utils.isAddress(recipient.value)) {
            status.textContent = "Enter a valid recipient address.";
            status.classList.add("error");
            return;
        }
        if (!amount.value || Number(amount.value) <= 0) {
            status.textContent = "Enter an amount greater than 0.";
            status.classList.add("error");
            return;
        }

        const durationSeconds = getSingleDurationSeconds();
        if (!durationSeconds) {
            status.textContent = "Enter a valid custom duration.";
            status.classList.add("error");
            return;
        }

        status.textContent = "Sending transaction...";
        const value = ethers.utils.parseEther(amount.value);
        const tx = await contract.createStream(recipient.value, durationSeconds, { value });
        await tx.wait();

        status.textContent = "Stream created successfully.";
        recipient.value = "";
        amount.value = "";
        feePreview.textContent = "";
        loadStreams();
        if (typeof refreshBalance === "function") refreshBalance();
    } catch (err) {
        console.error(err);
        status.textContent = "Transaction failed.";
        status.classList.add("error");
    }
}
