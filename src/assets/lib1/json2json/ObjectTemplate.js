var ObjectTemplate, TemplateConfig, sysmo;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __indexOf = Array.prototype.indexOf || function(item) {
  for (var i = 0, l = this.length; i < l; i++) {
    if (this[i] === item) return i;
  }
  return -1;
};
sysmo = (typeof require === "function" ? require('sysmo') : void 0) || (typeof window !== "undefined" && window !== null ? window.Sysmo : void 0);
TemplateConfig = (typeof require === "function" ? require('./TemplateConfig') : void 0) || (typeof window !== "undefined" && window !== null ? window.json2json.TemplateConfig : void 0);
ObjectTemplate = (function() {
  function ObjectTemplate(config, parent) {
    this.paths = __bind(this.paths, this);
    this.pathAccessed = __bind(this.pathAccessed, this);
    this.getNode = __bind(this.getNode, this);
    this.nodeToProcess = __bind(this.nodeToProcess, this);
    this.aggregateValue = __bind(this.aggregateValue, this);
    this.updateContext = __bind(this.updateContext, this);
    this.processRemaining = __bind(this.processRemaining, this);
    this.processTemplate = __bind(this.processTemplate, this);
    this.chooseValue = __bind(this.chooseValue, this);
    this.chooseKey = __bind(this.chooseKey, this);
    this.createMapStructure = __bind(this.createMapStructure, this);
    this.processMap = __bind(this.processMap, this);
    this.processArray = __bind(this.processArray, this);
    this.transform = __bind(this.transform, this);    this.config = new TemplateConfig(config);
    this.parent = parent;
  }
  ObjectTemplate.prototype.transform = function(data) {
    var node;
    node = this.nodeToProcess(data);
    if (node == null) {
      return null;
    }
    switch (sysmo.type(node)) {
      case 'Array':
        return this.processArray(node);
      case 'Object':
        return this.processMap(node);
      default:
        return null;
    }
  };
  ObjectTemplate.prototype.processArray = function(node) {
    var context, element, index, key, value, _len;
    context = this.config.arrayToMap ? {} : [];
    for (index = 0, _len = node.length; index < _len; index++) {
      element = node[index];
      key = this.config.arrayToMap ? this.chooseKey(element) : index;
      value = this.createMapStructure(element);
      if (this.config.arrayToMap && this.config.ensureArray && !(context[key] != null)) {
        value = [value];
      }
      this.updateContext(context, element, value, key);
    }
    return context;
  };
  ObjectTemplate.prototype.processMap = function(node) {
    var context, nested_context, nested_key;
    if (this.config.ensureArray) {
      return this.processArray([node]);
    }
    context = this.createMapStructure(node);
    if (this.config.nestTemplate && (nested_key = this.chooseKey(node))) {
      nested_context = {};
      nested_context[nested_key] = context;
      context = nested_context;
    }
    return context;
  };
  ObjectTemplate.prototype.createMapStructure = function(node) {
    var context, key, nested, value;
    context = {};
    if (!this.config.nestTemplate) {
      return this.chooseValue(node, context);
    }
    for (key in node) {
      value = node[key];
      if (this.config.processable(node, value, key)) {
        nested = this.getNode(node, key);
        value = this.chooseValue(nested);
        this.updateContext(context, nested, value, key);
      }
    }
    return context;
  };
  ObjectTemplate.prototype.chooseKey = function(node) {
    var result;
    result = this.config.getKey(node);
    switch (result.name) {
      case 'value':
        return result.value;
      case 'path':
        return this.getNode(node, result.value);
      default:
        return null;
    }
  };
  ObjectTemplate.prototype.chooseValue = function(node, context) {
    var result;
    if (context == null) {
      context = {};
    }
    result = this.config.getValue(node);
    switch (result.name) {
      case 'value':
        return result.value;
      case 'path':
        return this.getNode(node, result.value);
      case 'template':
        return this.processTemplate(node, context, result.value);
      default:
        return null;
    }
  };
  ObjectTemplate.prototype.processTemplate = function(node, context, template) {
    var filter, key, value;
    if (template == null) {
      template = {};
    }
    for (key in template) {
      value = template[key];
      switch (sysmo.type(value)) {
        case 'String':
          filter = __bind(function(node, path) {
            return this.getNode(node, path);
          }, this);
          break;
        case 'Array':
          filter = __bind(function(node, paths) {
            var path, _i, _len, _results;
            _results = [];
            for (_i = 0, _len = paths.length; _i < _len; _i++) {
              path = paths[_i];
              _results.push(this.getNode(node, path));
            }
            return _results;
          }, this);
          break;
        case 'Function':
          filter = __bind(function(node, value) {
            return value.call(this, node, key);
          }, this);
          break;
        case 'Object':
          filter = __bind(function(node, config) {
            return new this.constructor(config, this).transform(node);
          }, this);
          break;
        default:
          filter = function(node, value) {
            return value;
          };
      }
      value = filter(node, value);
      this.updateContext(context, node, value, key);
    }
    this.processRemaining(context, node);
    return context;
  };
  ObjectTemplate.prototype.processRemaining = function(context, node) {
    var key, value;
    for (key in node) {
      value = node[key];
      if (!this.pathAccessed(node, key) && __indexOf.call(context, key) < 0 && this.config.processable(node, value, key)) {
        this.updateContext(context, node, value, key);
      }
    }
    return context;
  };
  ObjectTemplate.prototype.updateContext = function(context, node, value, key) {
    var formatted, item, _i, _len, _results;
    formatted = this.config.applyFormatting(node, value, key);
    if (sysmo.isArray(formatted)) {
      _results = [];
      for (_i = 0, _len = formatted.length; _i < _len; _i++) {
        item = formatted[_i];
        _results.push(this.aggregateValue(context, item.key, item.value));
      }
      return _results;
    } else if (formatted != null) {
      return this.aggregateValue(context, formatted.key, formatted.value);
    }
  };
  ObjectTemplate.prototype.aggregateValue = function(context, key, value) {
    var existing;
    if (!((value != null) || !this.config.ignoreEmpty)) {
      return context;
    }
    if (sysmo.isArray(context)) {
      context.push(value);
      return context;
    }
    existing = context[key];
    if (this.config.aggregate(context, key, value, existing)) {
      return context;
    }
    if (!(existing != null)) {
      context[key] = value;
    } else if (!sysmo.isArray(existing)) {
      context[key] = [existing, value];
    } else {
      context[key].push(value);
    }
    return context;
  };
  ObjectTemplate.prototype.nodeToProcess = function(node) {
    return this.getNode(node, this.config.getPath());
  };
  ObjectTemplate.prototype.getNode = function(node, path) {
    if (!path) {
      return null;
    }
    if (path === '.') {
      return node;
    }
    this.paths(node, path);
    return sysmo.getDeepValue(node, path, true);
  };
  ObjectTemplate.prototype.pathAccessed = function(node, path) {
    var key;
    key = path.split('.')[0];
    return this.paths(node).indexOf(key) !== -1;
  };
  ObjectTemplate.prototype.paths = function(node, path) {
    var index, paths;
    if (path) {
      path = path.split('.')[0];
    }
    this.pathNodes || (this.pathNodes = this.parent && this.parent.pathNodes || []);
    this.pathCache || (this.pathCache = this.parent && this.parent.pathCache || []);
    index = this.pathNodes.indexOf(node);
    if (!path) {
      if (index !== -1) {
        return this.pathCache[index];
      } else {
        return [];
      }
    }
    if (index === -1) {
      paths = [];
      this.pathNodes.push(node);
      this.pathCache.push(paths);
    } else {
      paths = this.pathCache[index];
    }
    if (path && paths.indexOf(path) === -1) {
      paths.push(path);
    }
    return paths;
  };
  return ObjectTemplate;
})();
if (typeof module !== "undefined" && module !== null) {
  module.exports = ObjectTemplate;
} else {
  window.json2json || (window.json2json = {});
  window.json2json.ObjectTemplate = ObjectTemplate;
}