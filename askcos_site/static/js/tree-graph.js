var container = document.getElementsByClassName('container')[0];
container.classList.remove('container')
container.classList.add('container-fluid')
container.style.width = null;

showLoader();

function hideNetwork(n) {
    var networkDiv = document.querySelectorAll('.tree-graph')[n];
    var hideDiv = document.querySelectorAll('.hideNetwork')[n];
    var showDiv = document.querySelectorAll('.showNetwork')[n];
    networkDiv.style.display = 'none';
    hideDiv.style.display = 'none';
    showDiv.style.display = '';
}

function hideAllNetworks() {
    for (var n = 0; n < document.querySelectorAll('.tree-graph').length; n++) {
        hideNetwork(n)
    }
}

function showNetwork(n) {
    var networkDiv = document.querySelectorAll('.tree-graph')[n];
    var hideDiv = document.querySelectorAll('.hideNetwork')[n];
    var showDiv = document.querySelectorAll('.showNetwork')[n];
    networkDiv.style.display = '';
    hideDiv.style.display = '';
    showDiv.style.display = 'none';
}

function showAllNetworks() {
    for (var n = 0; n < document.querySelectorAll('.tree-graph').length; n++) {
        showNetwork(n)
    }
}

function colorOf(child) {
    if (child['ppg']) {
        if (child['as_reactant'] || child['as_product']) {
            return "#1B5E20" // green
        } else {
            return '#FFC400' // yellow
        }
    } else {
        if (child['as_reactant'] || child['as_product']) {
            return '#E65100' // orange
        } else {
            return '#B71C1C' // red
        }
    }
}

function loadNodeLinkGraph(data) {
    /* Load tree in node link format into visjs and add visualization related attributes. */
    let visdata = {}
    for (node of data.nodes) {
        if (node.type === 'chemical') {
            node.image = `/api/v2/draw/?smiles=${encodeURIComponent(node.smiles)}`;
            node.shape = 'image';
            const buyableString = node.ppg !== 0 ? `$${node.ppg}/g` : 'not buyable';
            node.title = `${node.smiles}<br>${node.as_reactant} precedents as reactant<br>${node.as_product} precedents as product<br>${buyableString}`;
            node.borderWidth = 2;
            node.color = {
                border: colorOf(node)
            }
        } else {
            node.label = `${node.num_examples} examples
FF score: ${Number(node.plausibility).toFixed(3)}
Template score: ${Number(node.template_score).toFixed(3)}`;
            node['font'] = {align: 'center'}
        }
    }
    visdata.nodes = new vis.DataSet(data.nodes);
    visdata.edges = new vis.DataSet(data.edges);
    return visdata
}

function treeStats(tree) {
    let numReactions = 0
    let avgScore = 0
    let avgPlausibility = 0
    let minScore = 1.0
    let minPlausibility = 1.0
    for (node of tree.nodes) {
        if (node.type === 'reaction') {
            if (node.smiles.includes(app.settings.smiles)) {
                /* This is the first reaction step */
                tree.firstStepScore = node.template_score
            }
            numReactions += 1
            avgScore += node.template_score
            avgPlausibility += node.plausibility
            minScore = Math.min(minScore, node.template_score)
            minPlausibility = Math.min(minPlausibility, node.plausibility)
        }
    }
    avgScore /= numReactions
    avgPlausibility /= numReactions

    tree.numReactions = numReactions
    tree.avgScore = avgScore
    tree.avgPlausibility = avgPlausibility
    tree.minPlausibility = minPlausibility

    if ('score' in tree.graph) {
        tree.score = tree.graph.score
    }
    if ('cluster_id' in tree.graph) {
        tree.cluster_id = tree.graph.cluster_id
    }
}

function sortObjectArray(arr, prop, ascending) {
    arr.sort(function (a, b) {
        if (ascending) {
            return a[prop] - b[prop]
        } else {
            return b[prop] - a[prop]
        }
    })
}

function initializeNetwork(data, elementDiv) {
    var container = elementDiv;
    var options = {
        nodes: {
            color: {
                border: '#000000',
                background: '#FFFFFF'
            },
            shapeProperties: {
                useBorderWithImage: true,
                useImageSize: true
            }
        },
        edges: {
            length: 1
        },
        interaction: {
            multiselect: false,
            hover: true,
            dragNodes: false,
            dragView: true,
            selectConnectedEdges: false,
            tooltipDelay: 0,
            zoomView: true,
        },
        layout: {
            hierarchical: {
                direction: 'LR',
                levelSeparation: 250,
                nodeSpacing: 175,
                sortMethod: 'directed',
            }
        },
        physics: false
    };
    network = new vis.Network(container, data, options);
    network.on("beforeDrawing", function (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        ctx.restore();
    })
    return network
}

var csrftoken = getCookie('csrftoken');

var app = new Vue({
    el: '#app',
    data: {
        resultId: "",
        numChemicals: 0,
        numReactions: 0,
        alltrees: [],
        settings: {},
        tbVersion: null,
        showInfoPanel: false,
        selected: null,
        currentTreeId: 0,
        networkData: {},
        cluster: false,
        currentClusterId: 0,
        sortOrderAscending: false,
        treeSortOption: 'numReactions',
        infoPanelOptions: {
            id: 'infoPanel',
            headerTitle: 'Info',
            headerControls: {size: 'sm'},
            position: {my: 'left-top', at: 'left-top', of: '#graph'},
            panelSize: {width: 500, height: 500},
        },
        detailPanelOptions: {
            id: 'detailPanel',
            headerTitle: 'Node Details',
            headerControls: {size: 'sm'},
            position: {my: 'right-top', at: 'right-top', of: '#graph'},
            panelSize: {width: 500, height: 500},
        },
    },
    mounted: function () {
        this.resultId = this.$el.getAttribute('data-id');
        this.getResult(this.resultId);
    },
    methods: {
        getResult: function (id) {
            showLoader();
            fetch(`/api/v2/results/${id}/tree/`)
                .then(resp => resp.json())
                .then(json => {
                    var result = json['result'];
                    var stats = result['result']['status'];
                    var trees = result['result']['paths'];
                    this.numChemicals = stats[0];
                    this.numReactions = stats[1];
                    this.alltrees = trees;
                    this.settings = result['settings'];
                    if (!!this.settings.buyables_source
                        && (this.settings.buyables_source.includes(null) || this.settings.buyables_source.includes(''))) {
                        const to_remove = [null, '']
                        this.settings.buyables_source = this.settings.buyables_source.filter(item => !to_remove.includes(item))
                        this.settings.buyables_source.push('(no source)')
                    }
                    // If version is not present in the result, then it is version 1
                    this.tbVersion = result['settings']['version'] || 1;
                    this.networkContainer = document.getElementById('graph')
                    if (this.trees.length) {
                        this.allTreeStats()
                        this.setDefaultSortOrder()
                        this.sortTrees()
                        this.buildTree(this.currentTreeId, this.networkContainer);
                    }
                    hideLoader()
                })
        },
        buildTree: function (treeId, elem) {
            this.networkData = loadNodeLinkGraph(this.trees[treeId])
            this.network = initializeNetwork(this.networkData, elem);
            this.network.on('selectNode', function (params) {
                app.showNode(params.nodes[0])
            });
            this.network.on('deselectNode', this.clearSelection);
        },
        sortTrees: function () {
            sortObjectArray(this.trees, this.treeSortOption, this.sortOrderAscending)
            this.currentTreeId = 0
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
        setDefaultSortOrder: function() {
            this.sortOrderAscending = ['numReactions'].includes(this.treeSortOption)
        },
        nextTree: function () {
            if (this.currentTreeId < this.trees.length - 1) {
                this.clearSelection()
                this.currentTreeId = this.currentTreeId + 1
                this.buildTree(this.currentTreeId, this.networkContainer)
            }
        },
        prevTree: function () {
            if (this.currentTreeId > 0) {
                this.clearSelection()
                this.currentTreeId = this.currentTreeId - 1
                this.buildTree(this.currentTreeId, this.networkContainer)
            }
        },
        firstTree: function () {
            this.clearSelection()
            this.currentTreeId = 0
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
        lastTree: function () {
            this.clearSelection()
            this.currentTreeId = this.trees.length - 1
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
        nextCluster: function () {
            if (this.currentClusterId < this.maxClusterId) {
                this.clearSelection()
                this.currentClusterId = this.currentClusterId + 1
                this.currentTreeId = 0
                this.buildTree(this.currentTreeId, this.networkContainer)
            }
        },
        prevCluster: function () {
            if (this.currentClusterId > this.minClusterId) {
                this.clearSelection()
                this.currentClusterId = this.currentClusterId - 1
                this.currentTreeId = 0
                this.buildTree(this.currentTreeId, this.networkContainer)
            }
        },
        firstCluster: function () {
            this.clearSelection()
            this.currentClusterId = this.minClusterId
            this.currentTreeId = 0
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
        lastCluster: function () {
            this.clearSelection()
            this.currentClusterId = this.maxClusterId
            this.currentTreeId = 0
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
        allTreeStats: function () {
            this.trees.forEach(treeStats)
        },
        banItem: function () {
            var nodeId = this.network.getSelectedNodes();
            if (!nodeId.length) {
                return
            }
            var desc = prompt("Please enter a reason (for your records only)", "no reason");
            var node = this.networkData.nodes.get(nodeId[0]);
            if (node['type'] === 'chemical') {
                var url = '/api/v2/banlist/chemicals/'
                var speciesName = 'chemical'
            } else {
                var url = '/api/v2/banlist/reactions/'
                var speciesName = 'reaction'
            }
            const body = {
                smiles: node.smiles,
                description: desc,
            };
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken
                },
                body: JSON.stringify(body)
            })
                .then(resp => resp.json())
                .then(json => {
                    const datetime = dayjs(json.created).format('MMMM D, YYYY h:mm A');
                    alert(`Banned ${speciesName} ${node.smiles} at ${datetime}`)
                });
        },
        showNode: function (nodeId) {
            var node = this.networkData.nodes.get(nodeId)
            this.selected = node
            if (node.type == 'chemical' && !!!node.source) {
                fetch(`/api/v2/buyables/?q=${encodeURIComponent(node.smiles)}&source=${this.settings.buyables_source}`)
                    .then(resp => resp.json())
                    .then(json => {
                        if (json.result.length) {
                            this.networkData.nodes.update({id: node.id, source: json.result[0].source})
                            this.$set(this.selected, 'source', json.result[0].source)
                        }
                    })
            }
        },
        clearSelection: function () {
            this.selected = null
        },
    },
    computed: {
        trees: function () {
            if (this.cluster) {
                return this.alltrees.filter(tree => tree.cluster_id === this.currentClusterId)
            } else {
                return this.alltrees
            }
        },
        maxClusterId: function () {
            if (!!this.alltrees.length && 'cluster_id' in this.alltrees[0]) {
                return Math.max(...this.alltrees.map(tree => tree.cluster_id))
            } else {
                return 0
            }
        },
        minClusterId: function () {
            if (!!this.alltrees.length && 'cluster_id' in this.alltrees[0]) {
                return Math.min(...this.alltrees.map(tree => tree.cluster_id))
            } else {
                return 0
            }
        },
    },
    watch: {
        cluster: function () {
            this.currentClusterId = this.minClusterId;
            this.currentTreeId = 0;
            this.buildTree(this.currentTreeId, this.networkContainer)
        },
    },
    delimiters: ['%%', '%%'],
});
