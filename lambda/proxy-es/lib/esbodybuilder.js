//start connection
var Promise=require('bluebird');
var bodybuilder = require('bodybuilder');
var get_keywords=require('./keywords');
var _=require('lodash');


function build_query(params) {
    return(get_keywords(params))
    .then(function(keywords) {
        var filter_query = {
            	'quniqueterms':{
                	query: keywords,
                    minimum_should_match: _.get(params,'minimum_should_match','2<75%'),
                    zero_terms_query: 'all',
                }
        	};
        var match_query = {
            	'quniqueterms':{
                	query: params.question,
                    boost:2,
                }
            };
        if (_.get(params, 'fuzziness', "false").toLowerCase() === "true") {
            filter_query.quniqueterms.fuzziness = "AUTO";
            match_query.quniqueterms.fuzziness = "AUTO";
        }
        var query=bodybuilder();
        if (keywords.length > 0) {
            query = query.filter(
            	'match', filter_query
            );          
        }
         // Filter out 'private' knowledge base
        // 'private' kb should have qid/question denoted by "__"
        query = query.notFilter(
            'prefix','qid', "__"
        ) ;
        query = query.orQuery(
            'match', match_query
        ) ;
        query = query.orQuery(
            'nested',{
            score_mode:'max',
            boost:2,
            path:'questions'},
            q=>q.query('match_phrase','questions.q',params.question)
        ) ;
        if (_.get(params, 'score_answer_field', "false").toLowerCase() === "true") {
            query = query.orQuery('match','a',params.question) ;  
        }
        query = query.orQuery('match','t',_.get(params,'topic',''))
        .from(_.get(params,'from',0))
        .size(_.get(params,'size',1))
        .build();
        console.log("ElasticSearch Query",JSON.stringify(query,null,2));
        return new Promise.resolve(query);
    });
}

/**
 *  Filter for either 'public' or 'private' knowledge base
 * 'private' kb should have qid/question denoted by "__"
 * @param {*} params 
 */
function build_private_query(params) {
    return(get_keywords(params))
    .then(function(keywords) {
        var query=bodybuilder();
        query = query.filter('prefix','qid', "__")

        // if private kb only search qid
        query = query.orQuery('term','qid',params.question)
       
        query = query.from(_.get(params,'from',0))
        .size(_.get(params,'size',1))
        .build();
        console.log("ElasticSearch Private Query",JSON.stringify(query,null,2));

        return new Promise.resolve(query);
    });
}

module.exports=function(params){
    return params.searchPrivateKB ? build_private_query(params) : build_query(params);
};


/*
var testparams = {
    question: "what is an example user question",
    topic: "optional_topic",
    from: 0,
    size: 0
};
build_query(testparams)
*/