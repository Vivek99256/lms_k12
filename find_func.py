import re

with open('packages/conversational-ai-core/src/conversation.ts', 'r', encoding='utf-8') as f:
    content = f.read()

idx = content.find('function buildAdmissionEnquiryMessage(')
if idx >= 0:
    print(f'Function starts at index {idx}')
    print(repr(content[idx:idx+500]))
else:
    print('Function not found')
