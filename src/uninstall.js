var path = require('path'),
    fs   = require('fs'),
    et   = require('elementtree'),
    platform_modules = require('./platforms');


module.exports = function uninstallPlugin(platform, project_dir, name, plugins_dir, cli_variables, callback) {
    if (!platform_modules[platform]) {
        var err = new Error(platform + " not supported.");
        if (callback) {
            callback(err);
            return;
        }
        else throw err;
    }

    // Check that the plugin has already been fetched.
    var plugin_dir = path.join(plugins_dir, name);

    if (!fs.existsSync(plugin_dir)) {
        var err = new Error('Plugin "' + name + '" not found. Already uninstalled?');
        if (callback) {
            callback(err);
            return;
        }
        else throw err;
    }

    runUninstall(platform, project_dir, plugin_dir, plugins_dir, cli_variables, callback);
};

function runUninstall(platform, project_dir, plugin_dir, plugins_dir, cli_variables, callback) {
    var xml_path     = path.join(plugin_dir, 'plugin.xml')
      , xml_text     = fs.readFileSync(xml_path, 'utf-8')
      , plugin_et    = new et.ElementTree(et.XML(xml_text))
    var name         = plugin_et.findall('name').text;
    var plugin_id    = plugin_et._root.attrib['id'];

    var platformTag = plugin_et.find('./platform[@name="'+platform+'"]');
    var platformTag = plugin_et.find('./platform[@name="'+platform+'"]');
    if (!platformTag) {
        // Either this plugin doesn't support this platform, or it's a JS-only plugin.
        // Either way, return now.
        // should call prepare probably!
        require('./../plugman').prepare(project_dir, platform, plugins_dir);
        if (callback) callback();
        return;
    }
    var handler = platform_modules[platform];

    // parse plugin.xml into transactions
    var txs = [];
    var sourceFiles = platformTag.findall('./source-file'),
        headerFiles = platformTag.findall('./header-file'),
        resourceFiles = platformTag.findall('./resource-file'),
        assets = platformTag.findall('./asset'),
        frameworks = platformTag.findall('./framework'),
        pluginsPlist = platformTag.findall('./plugins-plist'),
        configChanges = platformTag.findall('./config-file');
    assets = assets.concat(plugin_et.findall('./asset'));
    
    txs = txs.concat(sourceFiles, headerFiles, resourceFiles, frameworks, configChanges, assets, pluginsPlist);

    // pass platform-specific transactions into uninstall
    handler.uninstall(txs, plugin_id, project_dir, plugin_dir, function(err) {
        if (err) {
            // FAIL
            if (err. transactions) {
                handler.install(err.transactions.executed, plugin_id, project_dir, plugin_dir, cli_variables, function(superr) {
                    var issue = '';
                    if (superr) {
                        // Even reversion failed. super fail.
                        issue = 'Uninstall failed, then reversion of uninstallation failed. Sorry :(. Uninstalation issue: ' + err.stack + ', reversion issue: ' + superr.stack;
                    } else {
                        issue = 'Uninstall failed, plugin reversion successful so you should be good to go. Uninstallation issue: ' + err.stack;
                    }
                    var error = new Error(issue);
                    if (callback) callback(error);
                    else throw error;
                });
            } else {
                if (callback) callback(err);
                else throw err;
            }
        } else {
            // WIN!
            // call prepare after a successful uninstall
            require('./../plugman').prepare(project_dir, platform, plugins_dir);
            if (callback) callback();
        }
    });
}
