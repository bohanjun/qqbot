'use strict';

const
    cheerio = require('cheerio'),
    isUrl = require('is-url'),
    URL = require('url'),
    base = 'http://baike.baidu.com/item/',
    axios = require('axios'),
    wiki = require('wikijs').default,
    wikipedia = wiki({ apiUrl: 'https://wiki.ry4.me/w/api.php' }),
    moegirl = wiki({ apiUrl: 'https://zh.moegirl.org/api.php' }),
    _ = require('lodash');

function cutstr(str, len) {
    let str_length = 0;
    let str_cut = new String();
    let str_len = str.length;
    for (var i = 0; i < str_len; i++) {
        let a = str.charAt(i);
        str_length++;
        if (escape(a).length > 4)
            str_length++;
        str_cut = str_cut.concat(a);
        if (str_length >= len) {
            str_cut = str_cut.concat('...');
            return str_cut;
        }
    }
    if (str_length < len)
        return str;
}

async function ba(str) {
    let t = await baike(str).catch(err => global.console.error(err));
    return t.finalUrl + '\n' + t.item + '\n' + t.summary;
}
const baike = async query => (
    new Promise(async (resolve, reject) => {
        let page = await axios.get(isUrl(query) ? query : base + encodeURIComponent(query))
            .catch(e => { reject(e); });
        const finalUrl = decodeURIComponent(page.request.res.responseUrl);
        if (finalUrl.endsWith('/error.html')) return reject(new Error('Not Found'));
        const $ = cheerio.load(page.data);
        $('script,sup,.description,.album-list').remove(); // 删除参考资料 & 描述 & 词条图册
        const result = {
            finalUrl, // 最终网址
            name: $('dd.lemmaWgt-lemmaTitle-title h1').text(), // 名称
            item: $('dd.lemmaWgt-lemmaTitle-title h2').text(), // 义项
            summary: $('div.lemma-summary').text().trim(), // 概要
            contents: [] // 内容
        };
        $('div.basic-info dl dt').each((index, element) => {
            result.basicInfo = result.basicInfo || []; // 基本信息
            result.basicInfo.push({
                name: $(element).text().replace(/\s+/g, ''),
                value: $(element).next().text().replace(/\s+/g, '')
            });
        });
        $('li.list-dot a,li.item a,li.item span').each((index, element) => {
            const node = $(element);
            const href = node.attr('href');
            result.items = result.items || []; // 义项
            result.items.push({
                name: node.text(),
                url: href ? URL.resolve(base, href) : finalUrl,
                current: href ? false : true
            });
        });
        $('span.taglist').each((index, element) => {
            result.tags = result.tags || [];
            result.tags.push($(element).text().replace(/\s+/g, ''));
        });
        const contents = [];
        $('h2.para-title').each((index, element) => {
            const title = $(element).find('span.title-text').text();
            const content = [];
            for (let node = $(element).next(); node.get(0) && node.get(0).name !== 'h2'; node = node.next()) {
                content.push(getPara($, node));
            }
            contents.push({ title, content });
        });
        getPic($('div.summary-pic a').attr('href')).then(images => {
            result.images = images;
            Promise.all(contents.map(content => (
                new Promise(resolve => {
                    const title = content.title;
                    Promise.all(content.content).then(paras => {
                        const content = [];
                        for (let para of paras) {
                            if (para) content.push(para);
                        }
                        resolve({ title, content });
                    });
                })
            ))).then(contents => {
                result.contents = contents;
                if (result.contents.length) return resolve(result);
                const title = '';
                const content = [];
                $('div.para').each((index, element) => {
                    content.push(getPara($, $(element)));
                });
                Promise.all(content).then(paras => {
                    const content = [];
                    for (let para of paras)
                        if (para) content.push(para);
                    result.contents.push({ title, content });
                    resolve(result);
                });
            });
        });
    })
);
const getPara = ($, node) => (
    new Promise(resolve => {
        const text = node.text().replace(/\s+/g, '');
        const para = { name: node.get(0).name };
        if (text) {
            if (para.name === 'table') {
                para.table = [];
                node.find('tr').each((index, element) => {
                    const tr = [];
                    para.table.push(tr);
                    $(element).children().each((index, element) => {
                        tr.push({
                            name: element.name,
                            text: $(element).text().replace(/\s+/g, '')
                        });
                    });
                });
            } else {
                para.text = text;
            }
        }
        const promises = [];
        node.find('a[href]').each((index, element) => {
            if (!$(element).find('img').length) return;
            if (promises.length > 99) return;
            promises.push(getPic($(element).attr('href')));
        });
        Promise.all(promises).then(images => {
            para.imgs = [];
            for (let imgs of images) {
                for (let img of imgs) {
                    para.imgs.push(img);
                }
            }
            resolve(text || para.imgs ? para : null);
        });
    })
);

const getPic = href => (
    new Promise(resolve => {
        if (!href) return resolve([]);
        request(href).then($ => {
            if (!$) return resolve([]);
            const pics = new Set();
            pics.add($('a.origin').attr('href'));
            if (!href.endsWith('ct=cover')) {
                return resolve(Array.from(pics));
            }
            const promises = [];
            $('a.pic-item[href]').each((index, element) => {
                const origUrl = $(element).attr('href');
                promises.push(request(origUrl));
            });
            Promise.all(promises).then($$ => {
                for (let $ of $$) {
                    pics.add($('a.origin').attr('href'));
                }
                resolve(Array.from(pics));
            });
        });
    })
);
const request = async href => {
    let page = await axios.get(URL.resolve(base, href));
    return page.data ? cheerio.load(page.data) : null;
};

exports.exec = async (args, e, context) => {
    args = args.split(' ');
    console.log('wiki', args, context.user_id);
    if (args.length == 0) {
        return "unknown subtype. use 'wiki help' for help."
    } else if (args[0] == 'help') {
        return `Provided by masnn
wiki baike 文章名   百度百科
wiki wiki 文章名    维基百科
wiki wiki+ 文章名   维基百科，输出详细内容
wiki moe 文章名     萌娘百科
wiki moe+ 文章名    萌娘百科，输出详细内容`
    }
    if (args[0] == 'wiki+') {
        let page;
        try {
            page = await wikipedia.page(args[1]);
        } catch (e) {
            return 'No article found.';
        }
        return cutstr(await page.rawContent(), 1000);
    } else if (args[0] == 'wiki') {
        let page;
        try {
            page = await wikipedia.page(args[1]);
        } catch (e) {
            return 'No article found.';
        }
        return await page.summary();
    } else if (args[0] == 'baidu') {
        return ba(args[1]);
    } else if (args[0] == 'moe+') {
        let page;
        try {
            page = await moegirl.page(args[1]);
        } catch (e) {
            return 'No article found.';
        }
        return cutstr(await page.rawContent(), 1000);
    } else if (args[0] == 'moe') {
        let page;
        try {
            page = await moegirl.page(args[1]);
        } catch (e) {
            return 'No article found.';
        }
        return await page.summary();
    }
    return "unknown subtype. use 'wiki help' for help."
}