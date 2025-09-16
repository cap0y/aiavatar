export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  discountPrice?: number;
  stock: number;
  images: string[] | ProductImage[];
  category_id: number;
  category?: string;
  tags?: string[];
  status?: 'active' | 'sold_out' | 'hidden' | 'deleted';
  rating?: number;
  reviewCount?: number;
  seller_id: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductImage {
  id?: string;
  url: string;
  product_id?: string;
  order?: number;
  alt?: string;
} 