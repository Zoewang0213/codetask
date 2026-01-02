"""
LLM Agent - 使用 Claude API 处理用户问题并生成 Vega-Lite 可视化
"""

import os
import json
import anthropic
from typing import Dict, Any, List, Optional
from tools import TOOLS, TOOL_DESCRIPTIONS


class SciSciNetAgent:
    """使用 Claude API 的数据分析 Agent"""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found")

        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-20250514"

        # 系统提示
        self.system_prompt = """You are a data analysis assistant for UMD Computer Science research data from SciSciNet.

You have access to these tools to query the data:
1. query_papers_by_year(start_year, end_year) - Get paper counts by year
2. query_top_authors(top_n, metric) - Get top authors by paper_count/h_index/productivity
3. query_citation_stats() - Get overall citation statistics
4. query_papers_with_filters(year, min_citations, has_patents, limit) - Filter papers
5. query_collaboration_stats() - Get collaboration statistics
6. query_yearly_trend(metric) - Get yearly trends for papers/citations/patents

When the user asks a question:
1. First determine which tool(s) to call to get the data
2. Call the appropriate tool(s)
3. Analyze the results
4. If visualization is appropriate, generate a Vega-Lite specification
5. Respond with both the analysis and the visualization spec

For Vega-Lite charts, use this format in your response:
```vega-lite
{your vega-lite spec here}
```

Keep responses concise and data-driven. Always include specific numbers from the data."""

    def _get_tools_for_api(self) -> List[Dict]:
        """Convert tool descriptions to Claude API format"""
        tools = []
        for name, info in TOOL_DESCRIPTIONS.items():
            tool = {
                "name": name,
                "description": info['description'],
                "input_schema": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            }

            for param_name, param_info in info.get('parameters', {}).items():
                prop = {
                    "type": param_info['type'].replace('int', 'integer').replace('str', 'string').replace('bool', 'boolean'),
                    "description": param_info.get('description', '')
                }
                tool["input_schema"]["properties"][param_name] = prop

                if not param_info.get('optional', False):
                    if 'default' not in param_info:
                        tool["input_schema"]["required"].append(param_name)

            tools.append(tool)

        return tools

    def _execute_tool(self, name: str, args: Dict) -> Any:
        """Execute a tool and return results"""
        if name not in TOOLS:
            return {"error": f"Unknown tool: {name}"}

        try:
            result = TOOLS[name](**args)
            return result
        except Exception as e:
            return {"error": str(e)}

    def chat(self, user_message: str) -> Dict[str, Any]:
        """
        Process a user message and return response with optional visualization

        Returns:
            {
                'text': str,           # Text response
                'vega_lite': dict,     # Vega-Lite spec (if any)
                'data': list           # Raw data used (if any)
            }
        """
        messages = [{"role": "user", "content": user_message}]
        tools = self._get_tools_for_api()

        collected_data = []

        # Initial call
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            system=self.system_prompt,
            tools=tools,
            messages=messages
        )

        # Handle tool calls
        while response.stop_reason == "tool_use":
            # Find tool use blocks
            tool_uses = [block for block in response.content if block.type == "tool_use"]

            # Execute each tool
            tool_results = []
            for tool_use in tool_uses:
                result = self._execute_tool(tool_use.name, tool_use.input)
                collected_data.append({
                    'tool': tool_use.name,
                    'args': tool_use.input,
                    'result': result
                })
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_use.id,
                    "content": json.dumps(result)
                })

            # Continue conversation with tool results
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                system=self.system_prompt,
                tools=tools,
                messages=messages
            )

        # Extract final text response
        text_response = ""
        for block in response.content:
            if hasattr(block, 'text'):
                text_response += block.text

        # Extract Vega-Lite spec if present
        vega_lite = None
        import re
        # 匹配 ```vega-lite 或 ```json 后面跟着 vega-lite schema
        vega_pattern = r'```(?:vega-lite|json)\s*\n?([\s\S]*?)```'
        matches = re.findall(vega_pattern, text_response)

        for match in matches:
            try:
                spec = json.loads(match.strip())
                # 检查是否是 Vega-Lite spec
                if '$schema' in spec and 'vega' in spec.get('$schema', ''):
                    vega_lite = spec
                    break
                # 或者有 data 和 mark 字段
                elif 'data' in spec and ('mark' in spec or 'layer' in spec):
                    vega_lite = spec
                    break
            except json.JSONDecodeError:
                continue

        return {
            'text': text_response,
            'vega_lite': vega_lite,
            'data': collected_data
        }


def generate_vega_lite_spec(data: List[Dict], chart_type: str = 'bar', x_field: str = 'year', y_field: str = 'value', title: str = '') -> Dict:
    """
    Helper function to generate a Vega-Lite specification

    chart_type: 'bar', 'line', 'point', 'area'
    """
    spec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "title": title,
        "width": 600,
        "height": 400,
        "data": {"values": data},
        "mark": {"type": chart_type, "tooltip": True},
        "encoding": {
            "x": {"field": x_field, "type": "ordinal" if chart_type == 'bar' else "quantitative", "title": x_field.replace('_', ' ').title()},
            "y": {"field": y_field, "type": "quantitative", "title": y_field.replace('_', ' ').title()}
        }
    }

    # Add color for specific cases
    if 'metric' in data[0] if data else {}:
        spec["encoding"]["color"] = {"field": "metric", "type": "nominal"}

    return spec


if __name__ == '__main__':
    # 测试 Agent（需要设置 ANTHROPIC_API_KEY）
    import sys

    if not os.getenv('ANTHROPIC_API_KEY'):
        print("Please set ANTHROPIC_API_KEY environment variable")
        print("export ANTHROPIC_API_KEY=your-api-key")
        sys.exit(1)

    agent = SciSciNetAgent()

    # 测试问题
    test_questions = [
        "How many papers were published each year from 2020 to 2024?",
        "Who are the top 5 authors by paper count?",
        "What are the overall citation statistics?"
    ]

    for q in test_questions:
        print(f"\n{'='*60}")
        print(f"Q: {q}")
        print('='*60)

        result = agent.chat(q)
        print(f"\nResponse:\n{result['text'][:500]}...")

        if result['vega_lite']:
            print(f"\nVega-Lite spec generated: {result['vega_lite']['title'] if 'title' in result['vega_lite'] else 'Yes'}")
