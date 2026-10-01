terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  default = "us-east-1"
}

# EKS Cluster for VISTA Microservices
resource "aws_eks_cluster" "vista_cluster" {
  name     = "vista-production-cluster"
  role_arn = aws_iam_role.eks_cluster_role.arn

  vpc_config {
    subnet_ids = var.subnet_ids
  }
}

variable "subnet_ids" {
  type    = list(string)
  default = ["subnet-0123456789abcdef0", "subnet-0123456789abcdef1"]
}

resource "aws_iam_role" "eks_cluster_role" {
  name = "vista-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })
}

# Managed MSK Kafka Cluster for VISTA Messaging Backbone
resource "aws_msk_cluster" "vista_kafka" {
  cluster_name           = "vista-kafka-backbone"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type = "kafka.m5.large"
    client_subnets = var.subnet_ids
    security_groups = [aws_security_group.kafka_sg.id]
  }
}

resource "aws_security_group" "kafka_sg" {
  name        = "vista-kafka-sg"
  description = "Allow TLS traffic to Kafka brokers"
}
