/**
* A nodejs web server that acts as the backend of DC2
* various routes are defined including running and saving client-authored pipelines
* Individual DC2 modules are executed through Python wrappers
 *
 * @author  Elkindi Rezig
 * @institution MIT 
 */

var express = require('express');
var app = express();
var path = require('path');
var fs = require('fs');


const { TopologicalSort } = require('topological-sort');
app.use(express.json());



app.get('/go.js',function(request,response){
    response.sendfile(path.resolve('../release/go.js'));
});

app.get('/Figures.js',function(request,response){
    response.sendfile(path.resolve('../extensions/Figures.js'));
});

app.get('/DataInspector.js',function(request,response){
    response.sendfile(path.resolve('../extensions/DataInspector.js'));
});

app.get('/DataInspector.css',function(request,response){
    response.sendfile(path.resolve('../extensions/DataInspector.css'));
});


/**
* Runs a DC2 pipeline
* args
	@pipeline (Map): maps node id to its JSON description. Assumes the nodes are sorted in toplogical order
	@in_map (Map): maps input dependencies for each node id
* process
* 1/ loop through nodes in the graph
* 2/ call the corresponding python script depending on the value of cmd attribute
* 3/ params are passed automatically: 
*	3.1/ data source operator specifies file path for the first module(s)
*	3.2/ get output file path from module
*	3.3/ pass output file (and possible other files) as input file(s) to the next module
 */

function run_pipeline(pipeline, in_map)
{


	console.log(pipeline);

	//create output map
	var out_map = new Map();

	console.log("loop");

	for (var node_id of pipeline.keys())
	{
		console.log(pipeline.get(node_id).node.cmd);

		var cmd_name = pipeline.get(node_id).node.cmd;

		if (pipeline.get(node_id).node.hasOwnProperty('path')){
			console.log('data source detected ', pipeline.get(node_id));
			out_map[node_id] = pipeline.get(node_id).node.path;
			continue;
		}

		if (cmd_name == "mod_changePoints")
			out_map[node_id] = "out_"+node_id+".jpg";

		else out_map[node_id] = "out_"+node_id+".mat";

		//get input files list
		var args = [];
		args.push(cmd_name+".py");

		for (var n of in_map[node_id]){
			args.push(out_map[n]);
		}

		//push output file name
		args.push(out_map[node_id]);

		//run module
		console.log("running ", cmd_name, args);

		require('child_process').execSync(
    		'python ' + args.join(' '),
    		{stdio: 'inherit'}
);


	}


}


//map each module to its set of input sources (ds operator or out file)
function get_input_map(nodes){

	var in_map = new Map();

	for (var node_id of nodes.keys())
	{
		console.log(node_id);

		for (var value_id of nodes.get(node_id).children.keys())
		{
			console.log(value_id);

			if (value_id in in_map)
			{
				console.log("has value", node_id, value_id);
				in_map[value_id].push(node_id);
			}
			else
			{	
				in_map[value_id] = [];
				in_map[value_id].push(node_id);
			}
		}
	}

	//sort node ids (left edges have lower order in argument list than right edges)
	for (var key in in_map)
		in_map[key].sort(function(a, b){return b-a});

	console.log("in map: ", in_map);

	return in_map;
}


app.post('/run',function(request,response){
    console.log("running pipeline requested");
    console.log(request.body);

    //parse JSON file
    var obj = JSON.stringify(request.body);

    //console.log(JSON.stringify(request.body, null, 4));

    var pipeline = JSON.parse(obj);

    console.log(pipeline.linkDataArray);

    //top sorting
    const nodes = new Map();

    console.log("nodes")
    console.log(pipeline.nodeDataArray);

    //get nodes
    for (var id in pipeline.nodeDataArray)
    {
    	nodes.set(pipeline.nodeDataArray[id].key, pipeline.nodeDataArray[id]);

    }

    console.log(nodes);

    const sortOp = new TopologicalSort(nodes);

    for (var edge in pipeline.linkDataArray)
    {
    	//console.log("adding edge: ", pipeline.linkDataArray[edge].from, " ", pipeline.linkDataArray[edge].to)
    	sortOp.addEdge(pipeline.linkDataArray[edge].from, pipeline.linkDataArray[edge].to);
    }

	const sorted = sortOp.sort();
	Keys = [...sorted.keys()];

	console.log(sortOp.nodes);

	//var n = sorted.get(-1);

	//console.log(n.node);

	console.log("Sorted?");
	console.log(Keys);

	//link inputs
	var input_map = get_input_map(sortOp.nodes);

	run_pipeline(sorted, input_map);


});

app.get('/request_pipeline',function(request,response){
	var obj = JSON.stringify(request.query);

	var jss = JSON.parse(obj);

	var keys = Object.keys(jss);	

	console.log(jss[0]);

	response.sendfile(path.resolve(keys[0]) + '.json');


});

app.get('/fig.png',function(request,response){

	response.sendfile(path.resolve('fig.png'));


});

app.get('/download_output',function(request,response){
	var obj = JSON.stringify(request.query);

		console.log(obj);


	var jss = JSON.parse(obj);

	console.log(jss);

	var keys = Object.keys(jss);	

	console.log(Object.keys(jss)[0]);

	var file_name = path.resolve("Data/out_"+Object.keys(jss)[0]) + ".mat";

	var stats = fs.statSync(file_name)

    response.writeHead(200, {
        'Content-Type': 'application/x-binary',
        'Content-Length': stats["size"],
        'Content-Disposition': 'attachment; filename= out_'+Object.keys(jss)[0]+ '.mat'
    });

    var readStream = fs.createReadStream(file_name);
    // We replaced all the event handlers with a simple call to readStream.pipe()
    readStream.pipe(response);	


});


app.get('/', function(request, response){
    response.sendfile('./editor.html');

});

var server = app.listen(8080, function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)
})