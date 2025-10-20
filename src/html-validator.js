/**
 * 检测字符串中的HTML标签是否完整配对
 * 跳过Markdown语法，只检查HTML标签
 * @param {string} content - 要检查的内容
 * @returns {Object} 返回检查结果和修复建议
 */
function validateHtmlTags(content) {
  const results = {
    isValid: true,
    errors: [],
    suggestions: [],
    unclosedTags: [],
    orphanedTags: []
  };

  // 匹配HTML标签的正则表达式
  const tagRegex = /<\/?[a-zA-Z][^>]*>/g;
  const stack = []; // 用于跟踪未闭合的标签

  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    const tag = match[0];
    const tagName = tag.replace(/<\/?([a-zA-Z][^>]*)>/, '$1').split(' ')[0].toLowerCase();
    const isClosing = tag.startsWith('</');
    const isSelfClosing = tag.endsWith('/>') || ['img', 'br', 'hr', 'input', 'meta', 'link'].includes(tagName);
    const position = match.index;

    if (isSelfClosing) {
      // 自闭合标签，不需要配对
      continue;
    }

    if (isClosing) {
      // 闭合标签
      if (stack.length === 0) {
        results.errors.push(`发现多余的闭合标签: ${tag} (位置: ${position})`);
        results.orphanedTags.push({ tag, position });
        results.isValid = false;
      } else {
        const lastTag = stack.pop();
        if (lastTag.name !== tagName) {
          results.errors.push(`标签不匹配: 期望闭合 ${lastTag.name}，但发现 ${tagName} (位置: ${position})`);
          results.isValid = false;
        }
      }
    } else {
      // 开始标签
      stack.push({ name: tagName, position, tag });
    }
  }

  // 检查未闭合的标签
  if (stack.length > 0) {
    results.isValid = false;
    stack.forEach(unclosed => {
      results.errors.push(`未闭合的标签: ${unclosed.tag} (位置: ${unclosed.position})`);
      results.unclosedTags.push(unclosed);
    });
  }

  // 生成修复建议
  if (!results.isValid) {
    results.suggestions = generateFixSuggestions(results.unclosedTags, results.orphanedTags);
  }

  return results;
}

/**
 * 生成修复建议
 * @param {Array} unclosedTags - 未闭合的标签
 * @param {Array} orphanedTags - 多余的闭合标签
 * @returns {Array} 修复建议
 */
function generateFixSuggestions(unclosedTags, orphanedTags) {
  const suggestions = [];

  // 为未闭合的标签生成修复建议
  unclosedTags.forEach(tag => {
    suggestions.push({
      type: 'add_closing_tag',
      message: `在内容末尾添加闭合标签: </${tag.name}>`,
      tag: tag.name,
      position: tag.position
    });
  });

  // 为多余的闭合标签生成修复建议
  orphanedTags.forEach(tag => {
    suggestions.push({
      type: 'remove_orphaned_tag',
      message: `移除多余的闭合标签: ${tag.tag}`,
      tag: tag.tag,
      position: tag.position
    });
  });

  return suggestions;
}

/**
 * 修复HTML标签
 * @param {string} content - 原始内容
 * @returns {string} 修复后的内容
 */
function fixHtmlTags(content) {
  const validation = validateHtmlTags(content);
  
  if (validation.isValid) {
    return content;
  }

  let fixedContent = content;

  // 移除多余的闭合标签
  validation.orphanedTags.forEach(orphan => {
    fixedContent = fixedContent.replace(orphan.tag, '');
  });

  // 按照栈的顺序（从内到外）添加缺失的闭合标签
  // 由于栈是LIFO（后进先出），我们需要反转顺序来正确添加闭合标签
  const closingTags = validation.unclosedTags.map(unclosed => `</${unclosed.name}>`).reverse();
  fixedContent += closingTags.join('');

  return fixedContent;
}

// 导出函数
export { validateHtmlTags, fixHtmlTags };

// 如果直接运行此文件，进行测试
if (import.meta.url === `file://${process.argv[1]}`) {
  // 测试用例
  const testCases = [
    '## Markdown标题\n\n<ul><li>列表项1</li><li>列表项2',
    '<p>这是一个完整的段落</p>',
    '<p>这是一个不完整的段落',
    '<div><p>嵌套标签</p></div>',
    '<p>段落</p></p>',
    '<p>段落</p><div>另一个div',
    '## Markdown标题\n\n<p>HTML段落</p>',
    '<p style="color: red;">带样式的段落</p>',
    '<img src="test.jpg" alt="test" />', // 自闭合标签
    '<img /><br />', // 自闭合标签
  ];

  console.log('HTML标签验证测试:\n');
  
  testCases.forEach((testCase, index) => {
    console.log(`测试 ${index + 1}: ${testCase}`);
    const result = validateHtmlTags(testCase);
    console.log(`结果: ${result.isValid ? '✅ 有效' : '❌ 无效'}`);
    
    if (!result.isValid) {
      console.log('错误:');
      result.errors.forEach(error => console.log(`  - ${error}`));
      console.log('建议:');
      result.suggestions.forEach(suggestion => console.log(`  - ${suggestion.message}`));
      
      const fixed = fixHtmlTags(testCase);
      console.log(`修复后: ${fixed}`);
    }
    console.log('---');
  });
}
