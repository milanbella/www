var verbose
export function init () {
	window['buildProductIndex'] = function () {
		var db = openDatabaseSQL();
		console.log('build product index: start');

		function addRow (rows, i, cb) {
			if (i === rows.length) {
				cb();
			} else {
				var id = rows.item(i).m_product_id;
				var name = rows.item(i).name;

				indexAddText(db, name, id, 'sk', function (err) {
					if (err) {
						cb(err);
						return;
					}
					addRow(rows, i+1, cb);
				});
			}
		}


		db.transaction(function (tx) {

			tx.executeSql('drop table if exists product_index', [], function(tx, result) { 
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					return;
				}
			});
			tx.executeSql('drop index if exists product_index_term_idx', [], function(tx, result) { 
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					return;
				}
			});
			tx.executeSql('create table product_index (term text, id numeric)', [], function(tx, result) { 
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					return;
				}
			});
			tx.executeSql('create index product_index_term_idx on product_index (term)', [], function(tx, result) { 
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					return;
				}
			});
		}, function (err) {
			if (err) {
				console.error('error: ' + err);
				console.dir(err);
				return;
			}
		});  



		db.transaction(function (tx) {

			tx.executeSql('SELECT m_product_id, name   FROM m_product', [], function(tx, result) { 
				addRow(result.rows, 0, function (err) {
					if (err) {
						console.error('error: ' + err);
						console.dir(err);
						return;
					}
					console.log('build product index: finished');
				});
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					return;
				}
			})
		}, function (err) {
			if (err) {
				console.error('error: ' + err);
				console.dir(err);
				return;
			}
		});  
	};

	window['searchProductIndex'] = function (word) {
		var db = openDatabaseSQL();
		indexSearchWord (db, word, 'sk', function (err, ids) {
			if (err) {
				console.error('error: ' + err);
				console.dir(err);
				return;
			}
			console.log('found: ' + ids.length);
			db.transaction(function (tx) {
				ids.map(function (id) {
					tx.executeSql('SELECT * FROM m_product where m_product_id = ?', [id], function(tx, result) { 
						if (result.rows.length > 0) {
							for (var i=0; i < result.rows.length; i++) {
								var r = result.rows.item(i);
								console.log(r.m_product_id + ': ' + r.name);
							}
						} else {
							console.log(id + ':');
						}
					}, function (tx, err) {
						if (err) {
							console.error('error: ' + err);
							console.dir(err);
						}
					})
				});
			}, function (err) {
				console.error('error: ' + err);
				console.dir(err);
			});  
		});
	};

}

function openDatabaseSQL () {
	var db;
	var database_name = 'database.db';
	if (window['sqlitePlugin']) {
		db = window['sqlitePlugin'].openDatabase({ name: database_name, location: 'default' });
	} else {
		db = window['openDatabase'](database_name, '1', 'my', 1024 * 1024 * 100);
	}
	return db;
}


function indexSearchWord (db, word, lang, cb) {
	var term = stem(word, lang);
	if (term) {
		db.transaction(function (tx) {

			tx.executeSql('select id from product_index where term = ?', [term], function(tx, result) { 
				var ids = [];
				for (var i=0; i < result.rows.length; i++) {
					ids.push(result.rows.item(i).id);
				}
				cb(null, ids);
			}, function (tx, err) {
				if (err) {
					console.error('error: ' + err);
					console.dir(err);
					cb(err);
					return;
				}
			})

		}, function (err) {
			if (err) {
				console.error('error: ' + err);
				console.dir(err);
				cb(err);
				return;
			}
		});  
	} else {
		cb(null, []);
	}
}

function indexAddText (db, text, id, lang, cb) {
	//console.log('adding text: ' + text); //@@@@@@@@@@@@@@@@@@@@@@@
	var words = text.split(/\s/);

	db.transaction(function (tx) {

		function addw (words, cb) {
			if (words.length === 0) {
				cb();
				return;
			}
			var word = words.pop().trim();
			//console.log('adding word: ' + word); //@@@@@@@@@@@@@@@@@@@@@@@
			var term = stem(word, lang);
			if (term) {
				//console.log('adding term: ' + term); //@@@@@@@@@@@@@@@@@@@@@@@
				tx.executeSql('insert or replace into product_index (term, id) VALUES (?, ?)', [term, id], function(tx, result) { 
					addw(words, cb);
				}, function (tx, err) {
					if (err) {
						console.error('error: ' + err);
						console.dir(err);
						cb(err);
						return;
					}
				})
			} else {
				addw(words, cb);
			}
		}

		addw(words, cb);

	}, function (err) {
		if (err) {
			console.error('error: ' + err);
			console.dir(err);
			cb(err);
			return;
		}
	});  
}

function stem (word, lang) {
	word = word.trim();
	if (word.length === 0) {
		return;
	}
	if (lang === 'sk') {
		if (stopwordsSlovak[word]) {
			return;
		}
		var term = stemSlovak(word, true);
		term = remapCharactersSlovak(term);
		return term;
	} else {
		return;
	}
}


function ew (word, ...strs) {
	return strs.reduce(function (b, str) {
		return b || word.endsWith(str);
	}, false);
} 

function replace (word, n, str?) {
	word = word.substring(0, word.length - n);
	if (str) {
		return word + str;
	} else {
		return word;
	}
}

function stemSlovak (word, aggressive) {

	var s = removeCase(word);
	s = removePossessives(s);
	if (aggressive) {
		s = removeComparative(s);
		s = removeDiminutive(s);
		s = removeAugmentative(s);
		s = removeDerivational(s);
	}

	return s;

	function removeCase (word) {
		if (word.length > 7) {
			if (ew(word, "atoch")) {
				return replace(word, 5);
			}
		}
		if (word.length > 6) {
			if (ew(word, "aťom")) {
				word = replace(word, 3);
				return palatalize(word);
			}
		}
		if (word.length > 5) {
			if (ew(word, "och", "ich", "ích", "ého", "ami", "emi", "ému", "ete", "eti", "iho", "ího", "ími", "imu", "aťa")) {
				word = replace(word, 2);
				return palatalize(word);
			}
			if (ew(word, "ách", "ata", "aty", "ých", "ami", "ové", "ovi", "ými")) {
				return replace(word, 3);
			}
		}
		if (word.length > 4) {
			if (ew(word, "om")) {
				word = replace(word, 1);
				return palatalize(word);
			}
			if (ew(word, "es", "ém", "ím")) {
				word = replace(word, 2);
				return palatalize(word);
			}
			if (ew(word, "úm", "at", "ám", "os", "us", "ým", "mi", "ou", "ej")) {
				return replace(word, 2);
			}
		}
		if (word.length > 3) {
			if (ew(word, "eií")) {
				return palatalize(word);
			}
			if (ew(word, "ú", "y", "a", "o", "á", "é", "ý")) {
				return replace(word, 1);
			}
		}
		return word;
	}

	function removePossessives (word) {
		if (word.length > 5) {
			if (ew(word, "ov")) {
				return replace(word, 2);
			}
			if (ew(word, "in")) {
				word = replace(word, 1);
				return palatalize(word);
			}
		}
		return word;
	}

	function removeComparative (word) {
		if (word.length > 5) {
			if (ew(word, "ejš", "ějš")) {
				word = replace(word, 2);
				return palatalize(word);
			}
		}
		return word;
	}

	function removeDiminutive (word) {
		if (word.length > 7) {
			if (ew(word, "oušok")) {
				return replace(word, 5);
			}
		}
		if (word.length > 6) {
			if (ew(word, "ečok", "éčok", "ičok", "íčok", "enok", "énok", "inok", "ínok")) {
				word = replace(word, 3);
				return palatalize(word);
			}
			if (ew(word, "áčok", "ačok", "očok", "učok", "anok", "onok", "unok", "ánok")) {
				word = replace(word, 4);
				return palatalize(word);
			}
		}
		if (word.length > 5) {
			if (ew(word, "ečk", "éčk", "ičk", "íčk", "enk", "énk", "ink", "ínk")) {
				word = replace(word, 3);
				return palatalize(word);
			}
			if (ew(word, "áčk", "ačk", "očk", "učk", "ank", "onk", "unk", "átk", "ánk", "ušk")) {
				return replace(word, 3);
			}
		}
		if (word.length > 4) {
			if (ew(word, "ek", "ék", "ík", "ik")) {
				word = replace(word, 1);
				return palatalize(word);
			}
			if (ew(word, "ák", "ak", "ok", "uk")) {
				return replace(word, 1);
			}
		}
		if (word.length > 3) {
			if (ew(word, "k")) {
				return replace(word, 1);
			}
		}
		return word;
	}

	function removeAugmentative (word) {
		if (word.length > 6) {
			if (ew(word, "ajzn")) {
				return replace(word, 4);
			}
		}
		if (word.length > 5) {
			if (ew(word, "izn", "isk")) {
				word = replace(word, 2);
				return palatalize(word);
			}
		}
		if (word.length > 4) {
			if (ew(word, "ák")) {
				return replace(word, 2);
			}
		}
		return word;
	}

	function removeDerivational (word) {
		if (word.length > 8) {
			if (ew(word, 'obinec')) {
			return replace(word, 6);
			}
		}
		if (word.length > 7) {
			if (ew(word, 'ionár')) {
				word = replace(word, 4);
				return palatalize(word);
			}
			if (ew(word, "ovisk", "ovstv", "ovišt", "ovník")) {
				return replace(word, 5);
			}
		}
		if (word.length > 6) {
			if(ew(word, "ások", "nosť", "teln", "ovec", "ovík", "ovtv", "ovin", "štin")) {
				return replace(word, 4)
			}
			if(ew(word, "enic", "inec", "itel")) {
				word = replace(word, 3)
				return palatalize(word);
			}
		}
		if (word.length > 5) {
			if(ew(word, "árn")) {
				return replace(word, 3)
			}
			if(ew(word, "enk", "ián", "ist", "isk", "išt", "itb", "írn")) {
				word = replace(word, 2)
				return palatalize(word);
			}
			if(ew(word, "och", "ost", "ovn", "oun", "out", "ouš", "ušk", "kyn", "čan", "kář", "néř", "ník", "ctv", "stv")) {
				return replace(word, 3)
			}
		}
		if (word.length > 4) {
			if(ew(word, "áč", "ač", "án", "an", "ár", "ar", "ás", "as")) {
				return replace(word, 2)
			}
			if(ew(word, "ec", "en", "ér", "ír", "ic", "in", "ín", "it", "iv")){
				word = replace(word, 1)
				return palatalize(word);
			}
			if(ew(word, "ob", "ot", "ov", "oň", "ul", "yn", "čk", "čn", "dl", "nk", "tv", "tk", "vk")) {
				return replace(word, 2)
			}
		}
		if (word.length > 3) {
			if(ew(word, "c", "č", "k", "l", "n", "t")) {
				return replace(word, 1)
			}
		}
		return word;
	}

	function palatalize (word) {
		if (ew(word, "ci", "ce", "či", "če")) {
			return replace(word, 2, "k");
		} 
		if (ew(word, "zi", "ze", "ži", "že")) {
			return replace(word, 2, "h");
		} 
		if (ew(word, "čte", "čti", "čtí")) {
			return replace(word, 3, "ck");
		} 
		if (ew(word, "šte", "šti", "ští")) {
			return replace(word, 3, "sk");
		} 
		return replace(word, 1);
	}
}

var stopwordsSlovak = { 
	"a": true,
	"aby": true,
	"aj": true,
	"ak": true,
	"ako": true,
	"ale": true,
	"alebo": true,
	"and": true,
	"ani": true,
	"áno": true,
	"asi": true,
	"až": true,
	"bez": true,
	"bude": true,
	"budem": true,
	"budeš": true,
	"budeme": true,
	"budete": true,
	"budú": true,
	"by": true,
	"bol": true,
	"bola": true,
	"boli": true,
	"bolo": true,
	"byť": true,
	"cez": true,
	"čo": true,
	"či": true,
	"ďalší": true,
	"ďalšia": true,
	"ďalšie": true,
	"dnes": true,
	"do": true,
	"ho": true,
	"ešte": true,
	"for": true,
	"i": true,
	"ja": true,
	"je": true,
	"jeho": true,
	"jej": true,
	"ich": true,
	"iba": true,
	"iné": true,
	"iný": true,
	"som": true,
	"si": true,
	"sme": true,
	"sú": true,
	"k": true,
	"kam": true,
	"každý": true,
	"každá": true,
	"každé": true,
	"každí": true,
	"kde": true,
	"keď": true,
	"kto": true,
	"ktorá": true,
	"ktoré": true,
	"ktorou": true,
	"ktorý": true,
	"ktorí": true,
	"ku": true,
	"lebo": true,
	"len": true,
	"ma": true,
	"mať": true,
	"má": true,
	"máte": true,
	"medzi": true,
	"mi": true,
	"mna": true,
	"mne": true,
	"mnou": true,
	"musieť": true,
	"môcť": true,
	"môj": true,
	"môže": true,
	"my": true,
	"na": true,
	"nad": true,
	"nám": true,
	"náš": true,
	"naši": true,
	"nie": true,
	"nech": true,
	"než": true,
	"nič": true,
	"niektorý": true,
	"nové": true,
	"nový": true,
	"nová": true,
	"noví": true,
	"o": true,
	"od": true,
	"odo": true,
	"of": true,
	"on": true,
	"ona": true,
	"ono": true,
	"oni": true,
	"ony": true,
	"po": true,
	"pod": true,
	"podľa": true,
	"pokiaľ": true,
	"potom": true,
	"práve": true,
	"pre": true,
	"prečo": true,
	"preto": true,
	"pretože": true,
	"prvý": true,
	"prvá": true,
	"prvé": true,
	"prví": true,
	"pred": true,
	"predo": true,
	"pri": true,
	"pýta": true,
	"s": true,
	"sa": true,
	"so": true,
	"svoje": true,
	"svoj": true,
	"svojich": true,
	"svojím": true,
	"svojími": true,
	"ta": true,
	"tak": true,
	"takže": true,
	"táto": true,
	"teda": true,
	"te": true,
	"tě": true,
	"ten": true,
	"tento": true,
	"the": true,
	"tieto": true,
	"tým": true,
	"týmto": true,
	"tiež": true,
	"to": true,
	"toto": true,
	"toho": true,
	"tohoto": true,
	"tom": true,
	"tomto": true,
	"tomuto": true,
	"tu": true,
	"tú": true,
	"túto": true,
	"tvoj": true,
	"ty": true,
	"tvojími": true,
	"už": true,
	"v": true,
	"vám": true,
	"váš": true,
	"vaše": true,
	"vo": true,
	"viac": true,
	"však": true,
	"všetok": true,
	"vy": true,
	"z": true,
	"za": true,
	"zo": true,
	"že": true,
};

function remapCharactersSlovak (word) {
	var w = "";
	for (var i=0; i < word.length; i++) {
		var s = word.charAt(i);
		var m = characterReMapSlovak[s];
		if (m) {
			w += m;
		} else {
			w += s;
		}
	}
	return w;
}

var characterReMapSlovak = {
	"A": "a",
	"Á": "a",
	"Ä": "a",
	"B": "b",
	"C": "c",
	"Č": "c",
	"D": "d",
	"Ď": "d",
	"E": "e",
	"É": "e",
	"F": "f",
	"G": "g",
	"H": "h",
	"I": "i",
	"Í": "i",
	"J": "j",
	"K": "k",
	"L": "l",
	"Ĺ": "l",
	"Ľ": "l",
	"M": "m",
	"N": "n",
	"Ň": "n",
	"O": "o",
	"Ó": "o",
	"Ô": "o",
	"P": "p",
	"Q": "q",
	"R": "r",
	"Ŕ": "r",
	"S": "s",
	"Š": "s",
	"T": "t",
	"Ť": "t",
	"U": "u",
	"Ú": "u",
	"V": "v",
	"W": "w",
	"X": "x",
	"Y": "y",
	"Ý": "y",
	"Z": "z",
	"Ž": "z",
	"a": "a",
	"á": "a",
	"ä": "a",
	"b": "b",
	"c": "c",
	"č": "c",
	"d": "d",
	"ď": "d",
	"e": "e",
	"é": "e",
	"f": "f",
	"g": "g",
	"h": "h",
	"i": "i",
	"í": "i",
	"j": "j",
	"k": "k",
	"l": "l",
	"ĺ": "l",
	"ľ": "l",
	"m": "m",
	"n": "n",
	"ň": "n",
	"o": "o",
	"ó": "o",
	"ô": "o",
	"p": "p",
	"q": "q",
	"r": "r",
	"ŕ": "r",
	"s": "s",
	"š": "s",
	"t": "t",
	"ť": "t",
	"u": "u",
	"ú": "u",
	"v": "v",
	"w": "w",
	"x": "x",
	"y": "y",
	"ý": "y",
	"z": "z",
	"ž": "z"
}
