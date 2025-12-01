#!/usr/bin/env python3
"""
Cut PDF to keep only first N pages
"""
import sys
from PyPDF2 import PdfReader, PdfWriter

def cut_pdf(input_path, output_path, max_pages):
    """Cut PDF to keep only first max_pages pages"""
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        total_pages = len(reader.pages)
        pages_to_keep = min(max_pages, total_pages)
        
        print(f"Processing {input_path}...")
        print(f"Total pages: {total_pages}")
        print(f"Keeping first {pages_to_keep} pages")
        
        for i in range(pages_to_keep):
            writer.add_page(reader.pages[i])
        
        # Write cut PDF
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        import os
        original_size = os.path.getsize(input_path) / (1024 * 1024)
        cut_size = os.path.getsize(output_path) / (1024 * 1024)
        reduction = ((original_size - cut_size) / original_size) * 100
        
        print(f"Original size: {original_size:.2f} MB")
        print(f"Cut size: {cut_size:.2f} MB (reduced by {reduction:.1f}%)")
        return True
    except Exception as e:
        print(f"Error cutting PDF: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 cut_pdf.py <input.pdf> <output.pdf> <max_pages>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    max_pages = int(sys.argv[3])
    
    if cut_pdf(input_file, output_file, max_pages):
        print(f"Successfully cut PDF to {output_file}")
    else:
        print("Cutting failed")
        sys.exit(1)

