#!/usr/bin/env python3
"""
Compress PDF files to reduce size
"""
import sys
from PyPDF2 import PdfReader, PdfWriter

def compress_pdf(input_path, output_path):
    """Compress a PDF file"""
    try:
        reader = PdfReader(input_path)
        writer = PdfWriter()
        
        print(f"Compressing {input_path}...")
        print(f"Original size: {len(reader.pages)} pages")
        
        for page in reader.pages:
            # Compress the page
            page.compress_content_streams()
            writer.add_page(page)
        
        # Write compressed PDF
        with open(output_path, 'wb') as output_file:
            writer.write(output_file)
        
        import os
        original_size = os.path.getsize(input_path) / (1024 * 1024)
        compressed_size = os.path.getsize(output_path) / (1024 * 1024)
        reduction = ((original_size - compressed_size) / original_size) * 100
        
        print(f"Compressed size: {compressed_size:.2f} MB (reduced by {reduction:.1f}%)")
        return True
    except Exception as e:
        print(f"Error compressing PDF: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 compress_pdf.py <input.pdf> <output.pdf>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    if compress_pdf(input_file, output_file):
        print(f"Successfully compressed to {output_file}")
    else:
        print("Compression failed")
        sys.exit(1)

