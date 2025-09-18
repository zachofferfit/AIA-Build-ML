// Global variables
let trainData = [];
let testData = [];
const features = ['Pclass', 'Sex', 'Age', 'SibSp', 'Parch', 'Fare', 'Embarked'];
const treeStates = [null, null, null]; // To store the state of each tree

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    document.getElementById('accuracy-toggle').addEventListener('change', updateCombinedResults);
});

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;
    tabcontent = document.getElementsByClassName("tab-content");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].style.display = "none";
    }
    tablinks = document.getElementsByClassName("tab-link");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].className = tablinks[i].className.replace(" active", "");
    }
    document.getElementById(tabName).style.display = "block";
    evt.currentTarget.className += " active";
}

// --- Data Loading and Processing ---
async function loadData() {
    // Assuming the CSV file is in a 'data' folder at the root of your GitHub Pages site
    const response = await fetch('data/titanic.csv');
    const csvText = await response.text();
    Papa.parse(csvText, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            const cleanedData = cleanData(results.data);
            splitData(cleanedData);
            initializeUI();
        }
    });
}

function cleanData(data) {
    return data.map(row => {
        // Handle missing Age: fill with median age
        if (row.Age === null || isNaN(row.Age)) {
            row.Age = 28; // Median age of the dataset
        }
        // Handle missing Embarked: fill with most common port 'S'
        if (row.Embarked === null) {
            row.Embarked = 'S';
        }
        // Map categorical to numerical for easier processing
        row.Sex = (row.Sex === 'female') ? 1 : 0; // female: 1, male: 0
        if (row.Embarked === 'S') row.Embarked = 0;
        else if (row.Embarked === 'C') row.Embarked = 1;
        else if (row.Embarked === 'Q') row.Embarked = 2;
        return row;
    }).filter(row => row.Survived !== null); // Remove rows where survival is unknown
}

function splitData(data) {
    data.sort(() => 0.5 - Math.random()); // Shuffle data
    const splitIndex = Math.floor(data.length * 0.8);
    trainData = data.slice(0, splitIndex);
    testData = data.slice(splitIndex);
}

// --- UI Initialization ---
function initializeUI() {
    populateDataTable(trainData.slice(0, 100)); // Show first 100 rows of train data
    for (let i = 1; i <= 3; i++) {
        createTreeUI(i);
        initializeTree(i);
    }
}

function populateDataTable(data) {
    const table = document.getElementById('data-table');
    if (!data.length) return;
    
    // Create header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headers = Object.keys(data[0]);
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    // Create body
    const tbody = table.createTBody();
    data.forEach(rowData => {
        const row = tbody.insertRow();
        headers.forEach(header => {
            const cell = row.insertCell();
            let value = rowData[header];
            // Revert mapped values for display
            if (header === 'Sex') value = value === 1 ? 'female' : 'male';
            if (header === 'Embarked') {
                if(value === 0) value = 'S';
                else if(value === 1) value = 'C';
                else if(value === 2) value = 'Q';
            }
            cell.textContent = value;
        });
    });
}

// --- Decision Tree Logic ---
function createTreeUI(treeIndex) {
    const container = document.getElementById(`Tree${treeIndex}`);
    container.innerHTML = `
        <h2>Decision Tree ${treeIndex}</h2>
        <div class="tree-container" id="tree-container-${treeIndex}">
            <div class="tree-controls" id="controls-${treeIndex}">
                <h4>Root Splitting Rule</h4>
                <select id="feature-${treeIndex}"></select>
                <select id="operator-${treeIndex}">
                    <option value="<">&lt;</option>
                    <option value=">=">&ge;</option>
                    <option value="==">==</option>
                </select>
                <div class="tooltip">
                    <input type="text" id="value-${treeIndex}" placeholder="Value">
                    <span class="tooltiptext" id="tooltip-${treeIndex}">Select a feature</span>
                </div>
            </div>
            <div class="node root-node" id="root-${treeIndex}"></div>
            <div class="node-split">
                <div class="node-level">
                    <div class="node" id="child1-${treeIndex}"></div>
                    <div class="node" id="child2-${treeIndex}"></div>
                </div>
            </div>
            <div class="node-split">
                 <div class="node-level">
                    <div class="node prediction-node" id="leaf1-${treeIndex}"></div>
                    <div class="node prediction-node" id="leaf2-${treeIndex}"></div>
                    <div class="node prediction-node" id="leaf3-${treeIndex}"></div>
                    <div class="node prediction-node" id="leaf4-${treeIndex}"></div>
                </div>
            </div>
            <div class="tree-accuracy" id="accuracy-${treeIndex}">Accuracy: -</div>
        </div>
    `;

    const featureSelect = document.getElementById(`feature-${treeIndex}`);
    features.forEach(f => {
        const option = document.createElement('option');
        option.value = f;
        option.textContent = f;
        featureSelect.appendChild(option);
    });

    // Add event listeners
    const controls = [`feature-${treeIndex}`, `operator-${treeIndex}`, `value-${treeIndex}`];
    controls.forEach(id => {
        document.getElementById(id).addEventListener('change', () => updateTree(treeIndex));
    });
    
    featureSelect.addEventListener('change', () => updateTooltip(treeIndex));
}

function initializeTree(treeIndex) {
    const defaultFeature = 'Pclass';
    document.getElementById(`feature-${treeIndex}`).value = defaultFeature;
    document.getElementById(`operator-${treeIndex}`).value = '<';
    document.getElementById(`value-${treeIndex}`).value = '3';
    updateTooltip(treeIndex);
    updateTree(treeIndex);
}

function updateTooltip(treeIndex) {
    const feature = document.getElementById(`feature-${treeIndex}`).value;
    const tooltip = document.getElementById(`tooltip-${treeIndex}`);
    let values = [...new Set(trainData.map(item => item[feature]))];
    
    if (typeof values[0] === 'number') {
        values.sort((a,b) => a-b);
        tooltip.textContent = `Numeric. Min: ${Math.min(...values)}, Max: ${Math.max(...values)}`;
    } else {
        tooltip.textContent = `Categorical. Values: ${values.slice(0,5).join(', ')}...`;
    }
}


function getNodeStats(data) {
    const total = data.length;
    if (total === 0) return { total: 0, survived: 0, rate: 0 };
    const survived = data.filter(p => p.Survived === 1).length;
    const rate = (survived / total * 100).toFixed(1);
    return { total, survived, rate };
}

function renderNode(elementId, stats, title) {
    const node = document.getElementById(elementId);
    node.innerHTML = `
        <h4>${title}</h4>
        <p>Passengers: ${stats.total}</p>
        <p>Survived: ${stats.survived}</p>
        <p>Survival Rate: ${stats.rate}%</p>
    `;
}

function renderPredictionNode(elementId, stats, title) {
    const node = document.getElementById(elementId);
    const prediction = stats.rate > 50 ? 'Survived' : 'Died';
    renderNode(elementId, stats, title);
    node.innerHTML += `<p>Prediction: <strong>${prediction}</strong></p>`;
    node.className = 'node prediction-node'; // Reset classes
    node.classList.add(prediction.toLowerCase());
}


function updateTree(treeIndex) {
    const feature = document.getElementById(`feature-${treeIndex}`).value;
    const operator = document.getElementById(`operator-${treeIndex}`).value;
    let value = document.getElementById(`value-${treeIndex}`).value;

    // Try to convert value to a number if it's not a string feature
    if (feature !== 'Sex' && feature !== 'Embarked') {
        value = parseFloat(value);
    } else { // Handle categorical features specifically
        if (feature === 'Sex') value = (value.toLowerCase() === 'female' ? 1 : 0);
        else { // Embarked
            if(value.toUpperCase() === 'S') value = 0;
            else if (value.toUpperCase() === 'C') value = 1;
            else if (value.toUpperCase() === 'Q') value = 2;
        }
    }
    
    if (isNaN(value)) { // Don't update if value is invalid
        return;
    }

    const rule = { feature, operator, value };
    treeStates[treeIndex - 1] = { rule };

    // --- Apply rule and update nodes ---
    // Root Node
    const rootStats = getNodeStats(trainData);
    renderNode(`root-${treeIndex}`, rootStats, 'Root Node (All Passengers)');

    // First Split
    const [split1, split2] = split(trainData, rule);
    const child1Stats = getNodeStats(split1);
    const child2Stats = getNodeStats(split2);
    renderNode(`child1-${treeIndex}`, child1Stats, `${feature} ${operator} ${value}`);
    renderNode(`child2-${treeIndex}`, child2Stats, `NOT (${feature} ${operator} ${value})`);

    // Second split (hardcoded for simplicity: Age < 16 and Pclass < 3)
    const [leaf1Data, leaf2Data] = split(split1, { feature: 'Age', operator: '<', value: 16 });
    const [leaf3Data, leaf4Data] = split(split2, { feature: 'Pclass', operator: '<', value: 3 });

    renderPredictionNode(`leaf1-${treeIndex}`, getNodeStats(leaf1Data), 'Leaf 1.1');
    renderPredictionNode(`leaf2-${treeIndex}`, getNodeStats(leaf2Data), 'Leaf 1.2');
    renderPredictionNode(`leaf3-${treeIndex}`, getNodeStats(leaf3Data), 'Leaf 2.1');
    renderPredictionNode(`leaf4-${treeIndex}`, getNodeStats(leaf4Data), 'Leaf 2.2');
    
    // Calculate and display accuracy
    const accuracy = calculateTreeAccuracy(trainData, treeIndex);
    document.getElementById(`accuracy-${treeIndex}`).textContent = `Training Accuracy: ${(accuracy * 100).toFixed(2)}%`;

    updateCombinedResults();
}

function split(data, rule) {
    const group1 = [];
    const group2 = [];
    data.forEach(row => {
        let conditionMet = false;
        if (rule.operator === '<') conditionMet = row[rule.feature] < rule.value;
        else if (rule.operator === '>=') conditionMet = row[rule.feature] >= rule.value;
        else if (rule.operator === '==') conditionMet = row[rule.feature] == rule.value;
        
        if (conditionMet) group1.push(row);
        else group2.push(row);
    });
    return [group1, group2];
}

// --- Accuracy Calculation ---
function predictSingle(row, treeIndex) {
    const rule = treeStates[treeIndex - 1].rule;
    
    const [split1, _] = split([row], rule);
    let finalGroup;

    if (split1.length > 0) { // Belongs to first branch
        const [leaf1, leaf2] = split([row], { feature: 'Age', operator: '<', value: 16 });
        finalGroup = leaf1.length > 0 ? leaf1 : leaf2;
    } else { // Belongs to second branch
        const [leaf3, leaf4] = split([row], { feature: 'Pclass', operator: '<', value: 3 });
        finalGroup = leaf3.length > 0 ? leaf3 : leaf4;
    }

    // This is a simplification: we need the stats of the training data that fell into this leaf
    // To get that, we must re-run the split on the full training data
    const [trainSplit1, trainSplit2] = split(trainData, rule);
    let prediction;
    if (split1.length > 0) {
        const [trainLeaf1, trainLeaf2] = split(trainSplit1, { feature: 'Age', operator: '<', value: 16 });
        const targetTrainGroup = (finalGroup === leaf1) ? trainLeaf1 : trainLeaf2;
        prediction = getNodeStats(targetTrainGroup).rate > 50 ? 1 : 0;
    } else {
        const [trainLeaf3, trainLeaf4] = split(trainSplit2, { feature: 'Pclass', operator: '<', value: 3 });
        const targetTrainGroup = (finalGroup === leaf3) ? trainLeaf3 : trainLeaf4;
        prediction = getNodeStats(targetTrainGroup).rate > 50 ? 1 : 0;
    }
    return prediction;
}


function calculateTreeAccuracy(data, treeIndex) {
    if (!treeStates[treeIndex - 1]) return 0;
    let correct = 0;
    data.forEach(row => {
        const prediction = predictSingle(row, treeIndex);
        if (prediction === row.Survived) {
            correct++;
        }
    });
    return data.length > 0 ? correct / data.length : 0;
}

function updateCombinedResults() {
    const useTestData = document.getElementById('accuracy-toggle').checked;
    const data = useTestData ? testData : trainData;
    document.getElementById('toggle-label').textContent = useTestData ? 'Test Data' : 'Training Data';

    let totalAcc = 0;
    const accuracies = [];
    for (let i = 1; i <= 3; i++) {
        const acc = calculateTreeAccuracy(data, i);
        accuracies.push(acc);
        document.getElementById(`tree${i}-acc`).textContent = `${(acc * 100).toFixed(2)}%`;
        totalAcc += acc;
    }

    const avgAcc = totalAcc / 3;
    document.getElementById('avg-acc').textContent = `${(avgAcc * 100).toFixed(2)}%`;

    // Ensemble Accuracy
    let ensembleCorrect = 0;
    data.forEach(row => {
        const p1 = predictSingle(row, 1);
        const p2 = predictSingle(row, 2);
        const p3 = predictSingle(row, 3);
        const votes = [p1, p2, p3];
        const survivedVotes = votes.filter(v => v === 1).length;
        const finalPrediction = survivedVotes >= 2 ? 1 : 0;
        if (finalPrediction === row.Survived) {
            ensembleCorrect++;
        }
    });
    const ensembleAcc = data.length > 0 ? ensembleCorrect / data.length : 0;
    document.getElementById('ensemble-acc').textContent = `${(ensembleAcc * 100).toFixed(2)}%`;
}
