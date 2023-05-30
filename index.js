const core = require("@actions/core");
// const github = require("@actions/github");
const fs = require("fs");

function matchRule(str, rule) {
  var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
}

function replaceRule(str, rule, replace) {
  var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  rule = "(?<=^)" + rule.split("*").map(escapeRegex).join("(?=.*)") + "(?=$)";
  rule = rule.replace(')(?=', '');
  return str.replace(new RegExp(rule), replace);
}


/**
 * Read file synchronously and return the content of it
 *
 * @param {String} path - full path of file to read
 * @returns {String} content of the file
 */
function readFile(path) {
  return fs.readFileSync(path, { encoding: "utf-8" });
}

/**
 * Write file then save it
 * has a directory validation, if the given directory doesn't exists it will create one
 *
 * @param {String} path - full path of new file
 * @param {String} content - content of the new file
 * @returns {void}
 */
function writeFile(path, content) {
  const pathArr = path.split("/");
  const dirPath = pathArr.splice(0, pathArr.length - 1).join("/");
  // create directory if doesn't exist
  if (dirPath && !fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  fs.writeFileSync(path, content);
}

function replaceJSON(jsonContent, ignore, replace, replaceTo){
  for (const key in jsonContent) {
    if (Object.hasOwnProperty.call(jsonContent, key)) {
      const element = jsonContent[key];
      if (ignore && matchRule(key, ignore) || replace && matchRule(key, replace)) {
        if (replace && matchRule(key, replace, replaceTo)) {
          let newkey = replaceRule(key, replace, replaceTo);
          jsonContent[newkey] = element;
        }
        delete jsonContent[key];
      }
    }
  }
  return jsonContent;
}

/**
 * Convert env file into JSON
 *
 * @param {String} inputPath - file path of env to convert
 * @param {String} outputPath - new file path of JSON output
 */
function convertEnvToJson(inputContent, outputPath, ignore, replace, replaceTo) {
  const properties = inputContent.split("\n").filter((val) => !!val.trim());
  let jsonContent = properties.reduce((acc, prop) => {
    const propArr = prop.split("=");
    const key = propArr.splice(0, 1);
    const value = propArr
      .join("=")
      .replace(/^['"]/gi, "")
      .replace(/['"]$/gi, "");
    return { ...acc, [key]: value };
  }, {});
  jsonContent = replaceJSON(jsonContent, ignore, replace, replaceTo);
  const jsonStr = JSON.stringify(jsonContent, undefined, 2);

  return jsonStr;
}

/**
 * Convert JSON file into env
 *
 * @param {String} inputPath - file path of JSON to convert
 * @param {String} outputPath - new file path of env output
 */
function convertJsonToEnv(inputContent, outputPath, ignore, replace, replaceTo) {
  let jsonContent = JSON.parse(inputContent);
  jsonContent = replaceJSON(jsonContent, ignore, replace, replaceTo);
  const envStr = Object.entries(jsonContent).reduce((acc, [key, value]) => {
    if(value.includes('\n')){
      value = value.replace(/'/g, "\\'");
      value = `'${value}'`;
    }
    return `${acc}${key}=${value}\n`;
  }, "");
  return envStr;
}

// main
(() => {
  try {
    /** @type {'env-to-json'|'json-to-env'} convert type */
    const type = core.getInput("type");
    const inputPath = core.getInput("input_path");
    const outputPath = core.getInput("output_path");
    const ignore = core.getInput("ignore") || undefined;
    const replace = core.getInput("replace") || undefined;
    const replaceTo = core.getInput("replaceTo") || '';

    const paths = inputPath.split(" ");

    if(!type) throw new Error('type is required');

    if(type !== 'env-to-json' && type !== 'json-to-env')
      throw new Error(`Type ${type} not allowed`);

    if (paths.length > 1) {
      let output = '';
      for (const path of paths) {
        if(path){
          const inputContent = readFile(path);
          console.log(`input: \n${inputContent}`);
          if(inputContent){
            if (type === "env-to-json")
              output += '\n' + convertEnvToJson(inputContent, outputPath, ignore, replace, replaceTo);
            if (type === "json-to-env")
              output += '\n' +  convertJsonToEnv(inputContent, outputPath, ignore, replace, replaceTo);
          }
        }
      }
      writeFile(outputPath, output);
      console.log(`output: \n${output}`);
      return output;
    }
  } catch (err) {
    core.setFailed(err);
  }
})();
