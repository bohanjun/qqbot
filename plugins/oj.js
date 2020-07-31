const axios = require('axios');

async function _luogu({ meta }, id) {
    if (!id) return await meta.$send('请输入要查询的题号！');
    let res;
    try {
        res = await axios({
            url: `https://www.luogu.com.cn/api/problem/detail/${id}`,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko',
                Accept: 'text/html, application/xhtml+xml, image/jxr, */*',
                'Accept-Language': 'zh-Hans-CN, zh-Hans; q=0.8, en-US; q=0.5, en; q=0.3',
                'Accept-Encoding': 'gzip, deflate',
            },
        });
    } catch (e) {
        return await meta.$send('获取失败');
    }
    const p = res.data;
    if (p.status === 200) return await meta.$send(`${p.data.StringPID} ${p.data.Name}\n${p.data.Description}`);
    return await meta.$send(p.data);
}

async function _pioj({ meta }, id) {
    id = id.trim();
    if (!id) return meta.$send('请输入要查询的题号！');
    const res = await axios.get(`https://oj.piterator.com/problem/${id}/json/`);
    return await meta.$send(
        `${res.data.title}\nDescription:\n${res.data.description}\nInput:\n${res.data.input}\nOutput:\n${res.data.output}\nInputFile: {res.data.input_file}\nOutputFile: {res.data.output_file}\nDifficulty: {res.data.difficulty}`
    );
}

exports.apply = (app) => {
    app.command('luogu <id...>', '获取Luogu题目').action(_luogu);
    app.command('pioj <id...>', '获取PiOJ题目').action(_pioj);
};
